package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import org.springframework.stereotype.Service;

@Service
public class EmployeeSensitiveAccessService {
    private final EmployeeRepository employeeRepository;
    private final UserAccountRepository userRepository;
    private final EmployeeAuthorizationService authorizationService;

    public EmployeeSensitiveAccessService(EmployeeRepository employeeRepository,
                                          UserAccountRepository userRepository,
                                          EmployeeAuthorizationService authorizationService) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
    }

    public Employee employee(Long id) {
        Employee employee = employeeRepository.findDetailById(id)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        return employee;
    }

    public Employee employeeForUpdate(Long id) {
        Employee employee = employeeRepository.findDetailByIdForUpdate(id)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        return employee;
    }

    public UserAccount actor() {
        return userRepository.getReferenceById(authorizationService.currentUser().id());
    }
}
