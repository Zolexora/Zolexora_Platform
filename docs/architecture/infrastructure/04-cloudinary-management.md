# Cloudinary Infrastructure Strategy

## The Challenge
Managing millions of user-generated images and videos across 10+ products requires strict organization, cost control, and security to prevent abuse.

## Big Tech Solutions for Scale

### 1. Organization & Multi-Tenancy
Do not dump all media into the root folder.
- **Folder Structure:** Enforce a strict hierarchy: `/{environment}/{product}/{entity}/{id}` (e.g., `/prod/marketplace/users/uuid/avatar.jpg`).
- **Sub-Accounts:** For completely separate business units (e.g., the ERP vs the AI tool), use Cloudinary Sub-Accounts to isolate usage quotas and API keys.

### 2. Transformation Security
- **Strict Transformations:** If you allow dynamic transformations via the URL (e.g., `w_500,h_500`), malicious users can request millions of unique permutations, exhausting your transformation quota and spiking costs.
- **Solution:** Disable dynamic URLs and strictly use **Named Transformations** (e.g., `t_profile_thumb`). Alternatively, use Cloudinary's "Strict Mode" to sign every transformation request cryptographically from the backend.

### 3. Upload Workflows
- **Direct-to-Cloud:** Do not route heavy video/image uploads through your FastAPI/Node backend (it wastes bandwidth and blocks event loops).
- **Signed Uploads:** Have the frontend request a signature from the backend, then upload the file directly from the browser to Cloudinary.
- **Webhooks:** Configure Cloudinary to send a Webhook back to your backend once the upload and processing (e.g., video compression) are completely finished.
