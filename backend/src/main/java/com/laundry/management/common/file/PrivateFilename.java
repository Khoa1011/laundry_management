package com.laundry.management.common.file;

public final class PrivateFilename {
    private PrivateFilename() {}

    public static String sanitize(String raw, String fallback) {
        String name = raw == null ? fallback : raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        name = name.replaceAll("[^A-Za-z0-9._ -]", "_");
        if (name.isBlank() || name.equals(".") || name.equals("..")) return fallback;
        return name.length() > 180 ? name.substring(name.length() - 180) : name;
    }
}
