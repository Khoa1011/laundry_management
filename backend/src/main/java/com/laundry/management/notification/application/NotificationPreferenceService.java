package com.laundry.management.notification.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.NotificationPreference;
import com.laundry.management.notification.infrastructure.NotificationPreferenceRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationPreferenceService {
    private final NotificationPreferenceRepository preferenceRepository;
    private final CurrentUserProvider currentUserProvider;

    public NotificationPreferenceService(
        NotificationPreferenceRepository preferenceRepository,
        CurrentUserProvider currentUserProvider
    ) {
        this.preferenceRepository = preferenceRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_PREFERENCES_MANAGE_OWN)")
    @Transactional(readOnly = true)
    public NotificationDtos.PreferenceResponse get() {
        Long userId = currentUserProvider.getRequired().id();
        return preferenceRepository.findByUserId(userId)
            .map(this::toResponse)
            .orElseGet(() -> toResponse(new NotificationPreference(userId)));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_PREFERENCES_MANAGE_OWN)")
    @Transactional
    public NotificationDtos.PreferenceResponse update(NotificationDtos.PreferenceUpdateRequest request) {
        Long userId = currentUserProvider.getRequired().id();
        NotificationPreference preference = preferenceRepository.findByUserId(userId)
            .orElseGet(() -> new NotificationPreference(userId));
        preference.update(
            request.soundEnabled(),
            request.soundKey(),
            request.soundVolume(),
            request.toastEnabled(),
            request.bellAnimationEnabled()
        );
        return toResponse(preferenceRepository.save(preference));
    }

    private NotificationDtos.PreferenceResponse toResponse(NotificationPreference preference) {
        return new NotificationDtos.PreferenceResponse(
            preference.isSoundEnabled(),
            preference.getSoundKey(),
            preference.getSoundVolume(),
            preference.isToastEnabled(),
            preference.isBellAnimationEnabled(),
            preference.getVersion()
        );
    }
}
