package com.laundry.management.employee.api;

import com.laundry.management.employee.domain.EmployeeAccountState;
import com.laundry.management.employee.domain.EmployeeAuditAction;
import com.laundry.management.employee.domain.EmployeeStatus;
import com.laundry.management.location.domain.AdministrativeVersion;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class EmployeeDtos {

    private EmployeeDtos() {
    }

    public record CreateRequest(
        @NotBlank @Size(min = 2, max = 150) String fullName,
        @Size(max = 30) String phone,
        @Email @Size(max = 254) String email,
        @PastOrPresent LocalDate birthDate,
        @Size(max = 500) String address,
        AdministrativeVersion administrativeVersion,
        @Size(max = 120) String province,
        @Positive Integer provinceCode,
        @Size(max = 120) String district,
        @Positive Integer districtCode,
        @Size(max = 120) String ward,
        @Positive Integer wardCode,
        @NotNull LocalDate hireDate,
        @NotNull Long positionId,
        @NotNull EmployeeStatus status,
        @NotEmpty List<@NotNull Long> branchIds,
        @NotNull Long primaryBranchId,
        Long linkedUserId
    ) {
    }

    public record UpdateRequest(
        @NotBlank @Size(min = 2, max = 150) String fullName,
        @Size(max = 30) String phone,
        @Email @Size(max = 254) String email,
        @PastOrPresent LocalDate birthDate,
        @Size(max = 500) String address,
        AdministrativeVersion administrativeVersion,
        @Size(max = 120) String province,
        @Positive Integer provinceCode,
        @Size(max = 120) String district,
        @Positive Integer districtCode,
        @Size(max = 120) String ward,
        @Positive Integer wardCode,
        @NotNull LocalDate hireDate,
        @NotNull Long version
    ) {
    }

    public record StatusRequest(
        @NotNull EmployeeStatus status,
        @Size(max = 500) String reason,
        @NotNull Long version
    ) {
    }

    public record PositionAssignmentRequest(
        @NotNull Long positionId,
        @NotNull Long version
    ) {
    }

    public record BranchAssignmentRequest(
        @NotNull Long branchId,
        boolean primary,
        @NotNull Long version
    ) {
    }

    public record VersionRequest(@NotNull Long version) {
    }

    public record AccountLinkRequest(
        @NotNull Long userId,
        @NotNull Long version
    ) {
    }

    public record PositionCreateRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,59}") String code,
        @NotBlank @Size(max = 150) String nameVi,
        @NotBlank @Size(max = 150) String nameEn,
        @Size(max = 500) String descriptionVi,
        @Size(max = 500) String descriptionEn,
        @PositiveOrZero int sortOrder
    ) {
    }

    public record PositionUpdateRequest(
        @NotBlank @Size(max = 150) String nameVi,
        @NotBlank @Size(max = 150) String nameEn,
        @Size(max = 500) String descriptionVi,
        @Size(max = 500) String descriptionEn,
        boolean active,
        @PositiveOrZero int sortOrder,
        @NotNull Long version
    ) {
    }

    public record PositionResponse(
        Long id,
        String code,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        boolean active,
        int sortOrder,
        long version
    ) {
    }

    public record BranchResponse(
        Long id,
        String code,
        String name,
        boolean primary,
        boolean active,
        Instant assignedAt,
        Instant unassignedAt
    ) {
    }

    public record AccountBranchResponse(Long id, String code, String name) {
    }

    public record AccountResponse(
        Long id,
        String username,
        String displayName,
        EmployeeAccountState status,
        List<AccountBranchResponse> branchAccess
    ) {
    }

    public record ListItemResponse(
        Long id,
        String employeeCode,
        String fullName,
        String phone,
        String email,
        LocalDate hireDate,
        EmployeeStatus status,
        PositionResponse position,
        BranchResponse primaryBranch,
        int activeBranchCount,
        AccountResponse account,
        long version,
        Instant updatedAt
    ) {
    }

    public record DetailResponse(
        Long id,
        String employeeCode,
        String fullName,
        String phone,
        String email,
        LocalDate birthDate,
        String address,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        LocalDate hireDate,
        EmployeeStatus status,
        PositionResponse position,
        List<BranchResponse> branches,
        AccountResponse account,
        long version,
        Instant createdAt,
        Instant updatedAt
    ) {
    }

    public record SelfProfileResponse(
        Long id,
        String employeeCode,
        String fullName,
        String phone,
        String email,
        LocalDate birthDate,
        String address,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        LocalDate hireDate,
        EmployeeStatus status,
        PositionResponse position,
        List<BranchResponse> branches,
        EmployeeAccountState accountStatus,
        long version,
        Instant updatedAt
    ) {
    }

    public record SortResponse(String property, String direction) {
    }

    public record ListResponse(
        List<ListItemResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        List<SortResponse> sort
    ) {
    }

    public record AuditResponse(
        Long id,
        EmployeeAuditAction action,
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        String reason,
        BranchOptionResponse branch,
        ActorResponse actor,
        Instant createdAt
    ) {
    }

    public record AuditListResponse(
        List<AuditResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }

    public record ActorResponse(Long id, String displayName) {
    }

    public record BranchOptionResponse(Long id, String code, String name) {
    }

    public record AccountOptionResponse(
        Long id,
        String username,
        String displayName,
        EmployeeAccountState status,
        List<AccountBranchResponse> branchAccess
    ) {
    }

    public record AccountOptionListResponse(
        List<AccountOptionResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }
}
