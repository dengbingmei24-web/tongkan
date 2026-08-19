package com.tongkan.mobile.ui;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.GradientDrawable;
import android.util.LruCache;
import android.widget.ImageView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class LibraryCoverLoader {
    private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(3);
    private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(12 * 1024) {
        @Override protected int sizeOf(String key, Bitmap bitmap) {
            return bitmap.getByteCount() / 1024;
        }
    };

    private LibraryCoverLoader() {}

    static void load(ImageView view, String value, BreathTheme theme) {
        String url = downloadUrl(value);
        view.setScaleType(ImageView.ScaleType.CENTER_CROP);
        view.setImageDrawable(null);
        GradientDrawable placeholder = new GradientDrawable();
        placeholder.setColor(theme.field());
        placeholder.setCornerRadius(theme.dp(12));
        view.setBackground(placeholder);
        view.setClipToOutline(true);
        view.setTag(url);
        if (url == null) return;
        Bitmap cached = CACHE.get(url);
        if (cached != null) {
            view.setImageBitmap(cached);
            return;
        }
        EXECUTOR.execute(() -> {
            Bitmap bitmap = download(url);
            if (bitmap == null) return;
            CACHE.put(url, bitmap);
            view.post(() -> {
                if (url.equals(view.getTag())) view.setImageBitmap(bitmap);
            });
        });
    }

    static String trustedCoverUrl(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        try {
            URL url = new URL(value.trim());
            String host = url.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getPort() != -1) return null;
            if (!(host.equals("hdslb.com") || host.endsWith(".hdslb.com") || host.equals("bilibili.com") || host.endsWith(".bilibili.com"))) return null;
            return url.toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    static String downloadUrl(String value) {
        String trusted = trustedCoverUrl(value);
        if (trusted == null || trusted.contains("@")) return trusted;
        return trusted + "@672w_378h_1c.jpg";
    }

    private static Bitmap download(String value) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(value).openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(7000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "image/jpeg,image/png;q=0.9,*/*;q=0.1");
            connection.setRequestProperty("Referer", "https://www.bilibili.com/");
            connection.setRequestProperty("User-Agent", "Tongkan-Android");
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            int declaredLength = connection.getContentLength();
            if (declaredLength > MAX_IMAGE_BYTES) return null;
            byte[] bytes;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int total = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_IMAGE_BYTES) return null;
                    output.write(buffer, 0, read);
                }
                bytes = output.toByteArray();
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, 640, 360);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static int sampleSize(int width, int height, int targetWidth, int targetHeight) {
        int sample = 1;
        while (width / (sample * 2) >= targetWidth && height / (sample * 2) >= targetHeight) sample *= 2;
        return sample;
    }
}
