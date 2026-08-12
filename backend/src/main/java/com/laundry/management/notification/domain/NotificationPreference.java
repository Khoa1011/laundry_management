package com.laundry.management.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "sound_enabled", nullable = false)
    private boolean soundEnabled;

    @Enumerated(EnumType.STRING)
    @Column(name = "sound_key", nullable = false, length = 40)
    private NotificationSoundKey soundKey;

    @Column(name = "sound_volume", nullable = false)
    private int soundVolume;

    @Column(name = "toast_enabled", nullable = false)
    private boolean toastEnabled;

    @Column(name = "bell_animation_enabled", nullable = false)
    private boolean bellAnimationEnabled;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected NotificationPreference() {
    }

    public NotificationPreference(Long userId) {
        this.userId = userId;
        this.soundEnabled = true;
        this.soundKey = NotificationSoundKey.SOFT_CHIME;
        this.soundVolume = 65;
        this.toastEnabled = true;
        this.bellAnimationEnabled = true;
    }

    public void update(
        boolean soundEnabled,
        NotificationSoundKey soundKey,
        int soundVolume,
        boolean toastEnabled,
        boolean bellAnimationEnabled
    ) {
        this.soundEnabled = soundEnabled;
        this.soundKey = soundKey;
        this.soundVolume = soundVolume;
        this.toastEnabled = toastEnabled;
        this.bellAnimationEnabled = bellAnimationEnabled;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public boolean isSoundEnabled() { return soundEnabled; }
    public NotificationSoundKey getSoundKey() { return soundKey; }
    public int getSoundVolume() { return soundVolume; }
    public boolean isToastEnabled() { return toastEnabled; }
    public boolean isBellAnimationEnabled() { return bellAnimationEnabled; }
    public long getVersion() { return version; }
}
