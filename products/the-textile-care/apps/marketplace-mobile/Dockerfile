FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY products/the-textile-care ./products/the-textile-care
RUN pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile

FROM deps AS dev
WORKDIR /app
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL:-http://localhost:4010} \
    EXPO_NO_DOTENV=1
EXPOSE 8081 19000 19001 19002
WORKDIR /app/products/the-textile-care/apps/marketplace-mobile
CMD ["pnpm", "start", "--", "--host", "lan", "--port", "8081"]

FROM reactnativecommunity/react-native-android:latest AS android-base
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    npm install -g eas-cli@latest
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/products/the-textile-care ./products/the-textile-care
ARG EXPO_PUBLIC_API_BASE_URL=https://api.thetextilecare.com
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL \
    GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false"
WORKDIR /app/products/the-textile-care/apps/marketplace-mobile
RUN npx expo prebuild --platform android --clean
RUN cd android && ./gradlew --version

FROM android-base AS android-apk
RUN cd android && ./gradlew assembleRelease --no-daemon
RUN mkdir -p /output && \
    find android/app/build/outputs/apk/release -name "*.apk" \
         -exec cp {} /output/marketplace-mobile-release.apk \;
CMD ["echo", "APK ready at /output/marketplace-mobile-release.apk"]

FROM android-base AS android-aab
RUN cd android && ./gradlew bundleRelease --no-daemon
RUN mkdir -p /output && \
    find android/app/build/outputs/bundle/release -name "*.aab" \
         -exec cp {} /output/marketplace-mobile-release.aab \;
CMD ["echo", "AAB ready at /output/marketplace-mobile-release.aab"]
