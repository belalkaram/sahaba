# =============================================================================
# Multi-Tenant LMS — Backend API — Production Dockerfile
# PHP 8.3 FPM | Multi-stage | Non-root | OPcache-enabled
# =============================================================================

# ── Stage 1: Composer dependencies ──────────────────────────────────────────
FROM composer:2.7 AS vendor

WORKDIR /app
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --optimize-autoloader \
        --no-interaction

COPY apps/api/ .
RUN composer dump-autoload --optimize --no-dev

# ── Stage 2: Runtime image ───────────────────────────────────────────────────
FROM php:8.3-fpm-alpine AS runtime

LABEL maintainer="LMS Platform Team"
LABEL description="Multi-Tenant LMS API — Production Runtime"

# PHP extensions
RUN apk add --no-cache \
        linux-headers \
        $PHPIZE_DEPS \
        libzip-dev \
        icu-dev \
        oniguruma-dev \
        sqlite-dev \
        sqlite-libs \
        postgresql-dev \
        postgresql-libs \
        postgresql-client \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pgsql \
        pdo_sqlite \
        mbstring \
        intl \
        zip \
        opcache \
        pcntl \
    && apk del --no-cache $PHPIZE_DEPS linux-headers

# OPcache — production tuning
COPY infrastructure/docker/api/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# PHP-FPM pool
COPY infrastructure/docker/api/fpm-pool.conf /usr/local/etc/php-fpm.d/www.conf

# Create non-root user
RUN addgroup -S lms && adduser -S lms -G lms

WORKDIR /var/www/html

# Copy application from vendor stage
COPY --from=vendor --chown=lms:lms /app .

# Permissions
RUN mkdir -p storage/framework/{cache,sessions,views} \
             storage/logs \
             bootstrap/cache \
    && chown -R lms:lms storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

USER lms

EXPOSE 9000

CMD ["php-fpm"]
