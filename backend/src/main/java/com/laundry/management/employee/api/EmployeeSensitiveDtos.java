package com.laundry.management.employee.api;

import com.laundry.management.employee.domain.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class EmployeeSensitiveDtos {
    private EmployeeSensitiveDtos() { }

    public record CompensationRequest(
        @NotNull @DecimalMin(value = "0.00") @Digits(integer = 16, fraction = 2) BigDecimal baseSalary,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
        @NotNull LocalDate effectiveFrom,
        @NotBlank @Size(max = 500) String reason
    ) { }

    public record CompensationResponse(Long id, BigDecimal baseSalary, String currency,
                                       LocalDate effectiveFrom, LocalDate effectiveTo,
                                       EmployeeCompensationStatus status, String reason,
                                       long version, ActorResponse actor, Instant createdAt) { }
    public record CompensationCurrentResponse(CompensationResponse current, CompensationResponse scheduled) { }
    public record CompensationHistoryResponse(List<CompensationResponse> items, int page, int size,
                                              long totalElements, int totalPages) { }

    public record IdentityRequest(
        @NotNull EmployeeIdentityType identityType,
        @NotBlank @Size(max = 40) String number,
        LocalDate issuedDate,
        @Size(max = 255) String issuedPlace,
        LocalDate expiresOn,
        @PositiveOrZero Long version
    ) { }

    public record IdentityVerificationRequest(
        @NotNull EmployeeIdentityVerificationStatus status,
        @Size(max = 500) String reason,
        @PositiveOrZero long version
    ) { }

    public record IdentityResponse(Long id, EmployeeIdentityType identityType, String number,
                                   boolean masked, LocalDate issuedDate, String issuedPlace,
                                   LocalDate expiresOn, EmployeeIdentityVerificationStatus verificationStatus,
                                   String verificationReason, Instant verifiedAt, long version, Instant updatedAt) { }

    public record DocumentResponse(Long id, EmployeeDocumentType documentType, String originalFilename,
                                   String contentType, long sizeBytes, String description, int documentVersion,
                                   EmployeeDocumentStatus status, Long replacesDocumentId, Instant deletedAt,
                                   String deleteReason, long recordVersion, ActorResponse actor, Instant createdAt) { }
    public record DocumentListResponse(List<DocumentResponse> items, int page, int size,
                                       long totalElements, int totalPages) { }
    public record DocumentDeleteRequest(@NotBlank @Size(max = 500) String reason,
                                        @PositiveOrZero long recordVersion) { }
    public record ActorResponse(Long id, String displayName) { }
}
