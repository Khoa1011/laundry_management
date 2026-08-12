package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeDtos;
import com.laundry.management.employee.domain.EmployeePosition;
import com.laundry.management.employee.infrastructure.EmployeePositionRepository;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeePositionService {

    private final EmployeePositionRepository positionRepository;
    private final UserAccountRepository userRepository;
    private final EmployeeAuthorizationService authorizationService;
    private final EmployeeDataNormalizer normalizer;
    private final EmployeeMapper mapper;

    public EmployeePositionService(
        EmployeePositionRepository positionRepository,
        UserAccountRepository userRepository,
        EmployeeAuthorizationService authorizationService,
        EmployeeDataNormalizer normalizer,
        EmployeeMapper mapper
    ) {
        this.positionRepository = positionRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.normalizer = normalizer;
        this.mapper = mapper;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_MANAGE)")
    @Transactional
    public EmployeeDtos.PositionResponse create(EmployeeDtos.PositionCreateRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (positionRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw duplicateCode();
        }
        EmployeePosition position = new EmployeePosition(
            code,
            normalizer.requiredText(request.nameVi(), "Vietnamese position name"),
            normalizer.requiredText(request.nameEn(), "English position name"),
            normalizer.optionalText(request.descriptionVi()),
            normalizer.optionalText(request.descriptionEn()),
            request.sortOrder(),
            actor()
        );
        try {
            return mapper.toPosition(positionRepository.saveAndFlush(position));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateCode();
        }
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_MANAGE)")
    @Transactional
    public EmployeeDtos.PositionResponse update(Long positionId, EmployeeDtos.PositionUpdateRequest request) {
        EmployeePosition position = positionRepository.findById(positionId).orElseThrow(this::positionNotFound);
        if (position.getVersion() != request.version()) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_VERSION_CONFLICT,
                "Position version conflict",
                "This employee position was updated by another user. Reload before saving again."
            );
        }
        position.update(
            normalizer.requiredText(request.nameVi(), "Vietnamese position name"),
            normalizer.requiredText(request.nameEn(), "English position name"),
            normalizer.optionalText(request.descriptionVi()),
            normalizer.optionalText(request.descriptionEn()),
            request.active(),
            request.sortOrder(),
            actor()
        );
        try {
            positionRepository.flush();
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_VERSION_CONFLICT,
                "Position version conflict",
                "This employee position was updated by another user. Reload before saving again."
            );
        }
        return mapper.toPosition(position);
    }

    private UserAccount actor() {
        return userRepository.getReferenceById(authorizationService.currentUser().id());
    }

    private ApiException positionNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.EMPLOYEE_POSITION_NOT_FOUND,
            "Employee position not found",
            "The employee position does not exist."
        );
    }

    private ApiException duplicateCode() {
        return new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.EMPLOYEE_POSITION_CODE_DUPLICATE,
            "Duplicate employee position code",
            "An employee position with this code already exists."
        );
    }
}
