package com.laundry.management.employee.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class EmployeeIdentityCrypto {
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private final byte[] encryptionKey;
    private final byte[] lookupKey;
    private final SecureRandom random = new SecureRandom();

    public EmployeeIdentityCrypto(@Value("${app.employee-sensitive.identity-key:}") String encodedKey) {
        byte[] masterKey = decodeKey(encodedKey);
        this.encryptionKey = derive(masterKey, "employee-identity:encryption:v1");
        this.lookupKey = derive(masterKey, "employee-identity:lookup:v1");
    }

    public String encrypt(String plaintext) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return "v1." + Base64.getUrlEncoder().withoutPadding().encodeToString(iv)
                + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted);
        } catch (GeneralSecurityException exception) {
            throw unavailable();
        }
    }

    public String decrypt(String value) {
        requireKey();
        try {
            String[] parts = value.split("\\.", 3);
            if (parts.length != 3 || !"v1".equals(parts[0])) throw new GeneralSecurityException("Unsupported ciphertext");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"),
                new GCMParameterSpec(GCM_TAG_BITS, Base64.getUrlDecoder().decode(parts[1])));
            return new String(cipher.doFinal(Base64.getUrlDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    public String lookupHash(String normalizedNumber) {
        requireKey();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(lookupKey, "HmacSHA256"));
            byte[] digest = mac.doFinal(("employee-identity:v1:" + normalizedNumber).getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException exception) {
            throw unavailable();
        }
    }

    private byte[] decodeKey(String value) {
        if (value == null || value.isBlank()) return new byte[0];
        try {
            byte[] decoded = Base64.getDecoder().decode(value.trim());
            return decoded.length == 32 ? decoded : new byte[0];
        } catch (IllegalArgumentException exception) {
            return new byte[0];
        }
    }

    private byte[] derive(byte[] masterKey, String label) {
        if (masterKey.length == 0) return new byte[0];
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(masterKey, "HmacSHA256"));
            return mac.doFinal(label.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            return new byte[0];
        }
    }

    private void requireKey() { if (encryptionKey.length == 0 || lookupKey.length == 0) throw unavailable(); }
    private ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.EMPLOYEE_IDENTITY_KEY_UNAVAILABLE,
            "Employee identity encryption unavailable",
            "Employee identity operations are unavailable because encryption is not configured correctly.");
    }
}
