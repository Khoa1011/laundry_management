package com.laundry.management.servicecatalog.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CatalogAuthorizationService {

    private final CurrentUserProvider currentUserProvider;
    private final BranchRepository branchRepository;
    private final UserAccountRepository userAccountRepository;

    public CatalogAuthorizationService(
        CurrentUserProvider currentUserProvider,
        BranchRepository branchRepository,
        UserAccountRepository userAccountRepository
    ) {
        this.currentUserProvider = currentUserProvider;
        this.branchRepository = branchRepository;
        this.userAccountRepository = userAccountRepository;
    }

    public Branch requireBranch(Long requestedBranchId) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        return branchRepository.findById(branchId)
            .filter(branch -> branch.getStatus() == AccountStatus.ACTIVE)
            .orElseThrow(() -> new ApiException(
                HttpStatus.FORBIDDEN,
                ErrorCode.BRANCH_ACCESS_DENIED,
                "Branch unavailable",
                "The selected branch is inactive or outside your authorized scope."
            ));
    }

    public void requireBranchScope(Long branchId) {
        currentUserProvider.resolveAuthorizedBranch(branchId);
    }

    public List<Long> branchScope() {
        CurrentUser user = currentUserProvider.getRequired();
        return user.branchIds().isEmpty() ? List.of(-1L) : user.branchIds();
    }

    public UserAccount actor() {
        return userAccountRepository.getReferenceById(currentUserProvider.getRequired().id());
    }

    public ApiException inaccessible(String resource) {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.PRICING_RESOURCE_NOT_FOUND,
            resource + " not found",
            "The requested pricing resource does not exist or is outside your authorized branch scope."
        );
    }
}
