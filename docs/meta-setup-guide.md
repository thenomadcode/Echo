# Meta Developer Setup Guide

This guide walks you through setting up Meta (Facebook/Instagram) messaging integration for Echo.

## Prerequisites

- A personal Facebook account
- A Facebook Page (for Messenger)
- Optional: An Instagram Professional Account linked to your Facebook Page (for Instagram DMs)

---

## Step 1: Go to Meta for Developers

1. Open **https://developers.facebook.com/**
2. Click **"Get Started"** or **"Log In"** (top right)
3. Log in with your personal Facebook account

---

## Step 2: Create a Business App

1. Click **"My Apps"** (top right) → **"Create App"**
2. Select **"Other"** for use case → Click **"Next"**
3. Select **"Business"** as app type → Click **"Next"**
4. Fill in:
   - **App name**: `Echo AI` (or your preferred name)
   - **App contact email**: your email
   - **Business Portfolio**: Select existing or create new
5. Click **"Create App"**

---

## Step 3: Add Messenger Product

1. In your App Dashboard, scroll down to **"Add products to your app"**
2. Find **"Messenger"** → Click **"Set up"**
3. You'll see Messenger settings panel

---

## Step 4: Get Your App Credentials

1. Go to **App Settings** → **Basic** (left sidebar)
2. Copy these values:
   - **App ID**: A number like `123456789012345`
   - **App Secret**: Click **"Show"**, enter your Facebook password, copy the secret

---

## Step 5: Configure Webhooks

1. Go to **Messenger** → **Settings** (left sidebar)
2. Scroll to **"Webhooks"** section
3. Click **"Add Callback URL"**
4. Enter:
   - **Callback URL**: `https://YOUR_CONVEX_SITE.convex.site/webhook/meta`
   - **Verify Token**: Make up a secret string (e.g., `my-secret-verify-token-12345`)
5. Click **"Verify and Save"**
6. After verification succeeds, subscribe to these webhook fields:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
   - `message_deliveries` (optional)
   - `message_reads` (optional)

> **Note**: Webhook verification will fail until you set the environment variables in Convex (Step 7)

---

## Step 6: Configure Facebook Login

1. Go to **App Settings** → **Basic**
2. Scroll to **"Add Platform"** → Select **"Website"**
3. Enter your site URL (e.g., `https://your-app.com`)
4. Go to **Facebook Login for Business** → **Settings** (left sidebar)
5. Add **Valid OAuth Redirect URIs**:
   - `https://YOUR_CONVEX_SITE.convex.site/meta/callback`

---

## Step 7: Set Environment Variables in Convex

### Option A: Local Development

Add to `packages/backend/.env.local`:

```bash
META_APP_ID=your_app_id_from_step_4
META_APP_SECRET=your_app_secret_from_step_4
META_WEBHOOK_VERIFY_TOKEN=my-secret-verify-token-12345
```

### Option B: Convex Dashboard

1. Go to https://dashboard.convex.dev/
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the 3 variables:

| Variable | Value |
|----------|-------|
| `META_APP_ID` | Your App ID from Step 4 |
| `META_APP_SECRET` | Your App Secret from Step 4 |
| `META_WEBHOOK_VERIFY_TOKEN` | The verify token you created in Step 5 |

---

## Step 8: Add Test Users

1. Go to **App Roles** → **Roles** (left sidebar)
2. Click **"Add People"**
3. Add yourself and any testers as **Testers**
4. Each person must **accept the invitation** via Facebook notification

---

## Step 9: Connect a Facebook Page

You need a Facebook Page to receive Messenger messages:

1. If you don't have one, create at: https://www.facebook.com/pages/create
2. In your Meta App, go to **Messenger** → **Settings**
3. Under **"Access Tokens"**, click **"Add or Remove Pages"**
4. Select your Facebook Page and authorize

---

## Step 10: Link Instagram Business Account (Optional)

To receive Instagram DMs:

1. Your Instagram must be a **Professional Account** (Business or Creator)
2. It must be **linked to your Facebook Page**

### How to set up:

1. Open Instagram app → Settings → Account
2. Switch to **Professional Account**
3. Choose Business or Creator
4. Link to your Facebook Page when prompted

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `META_APP_ID` | Your Meta App ID | `123456789012345` |
| `META_APP_SECRET` | Your Meta App Secret | `abc123def456...` |
| `META_WEBHOOK_VERIFY_TOKEN` | Secret string for webhook verification | `my-secret-token-xyz` |

---

## URLs Reference

Replace `YOUR_CONVEX_SITE` with your actual Convex deployment URL.

| Purpose | URL |
|---------|-----|
| Webhook Callback | `https://YOUR_CONVEX_SITE.convex.site/webhook/meta` |
| OAuth Redirect | `https://YOUR_CONVEX_SITE.convex.site/meta/callback` |

---

## Testing the Integration

1. Ensure all environment variables are set
2. Log into Echo as a test user
3. Go to **Settings** → **Integrations** → **Meta**
4. Click **"Connect with Facebook"**
5. Complete the OAuth flow and authorize permissions
6. Verify the connection shows as "Connected"
7. Send a test message via Messenger or Instagram DM to your linked Page
8. Check that the message appears in Echo's Conversations

---

## Going to Production (App Review)

For non-test users, you'll need to complete Meta's App Review:

1. **Business Verification**: Verify your business identity
2. **App Review Submission**:
   - Use case documentation explaining how you use messaging
   - Screen recording of the full user flow
   - Privacy Policy URL
3. **Request Advanced Access** for `instagram_manage_messages`
4. **Complete Data Use Checkup**

Timeline: App Review typically takes 2-4 weeks.

---

## Troubleshooting

### Webhook verification fails
- Ensure `META_WEBHOOK_VERIFY_TOKEN` in Convex matches exactly what you entered in Meta
- Check that your Convex deployment is running
- Verify the callback URL is correct

### OAuth redirect fails
- Ensure the redirect URI in Meta matches exactly: `https://YOUR_CONVEX_SITE.convex.site/meta/callback`
- Check that Facebook Login for Business is properly configured

### No messages received
- Verify webhook subscriptions include `messages`
- Ensure your Facebook Page is connected to the app
- Check that the user messaging you is a test user (in Development Mode)

### Instagram DMs not working
- Confirm Instagram account is Professional (Business or Creator)
- Verify Instagram is linked to the Facebook Page
- Instagram must be linked to a Page that's connected to your Meta App
