# Testing Guide - Webhook Architecture Changes

## What Was Fixed

1. **AI Message Duplication** - Messages now appear only once
2. **Webhook Blocking** - Webhooks return in < 200ms (was 5-30 seconds)

## Before Testing

Make sure your development environment is running:

```bash
# Terminal 1: Start Convex backend
cd packages/backend
bun run dev

# Terminal 2: Start web app
cd apps/web
bun run dev
```

## Test 1: Fast Webhook Response

**Goal**: Verify webhooks return immediately

### Steps:
1. Open Bruno and load the `bruno/` collection
2. Select the `whatsapp/send-message.bru` request
3. Note the current time
4. Click "Send"
5. Check the response time in Bruno

**Expected Result:**
- ✅ Response received in < 500ms
- ✅ Status: 200 OK
- ✅ No timeout errors

**Before fix:** 5-30 seconds (often timed out)
**After fix:** ~100-200ms

## Test 2: No Message Duplication

**Goal**: Verify AI messages appear only once

### Steps:
1. Send a message using Bruno (e.g., `whatsapp/examples/greeting.bru`)
2. Wait 5-10 seconds for AI to process
3. Open the conversations page in your web app
4. Navigate to the conversation
5. Count how many AI response messages appear

**Expected Result:**
- ✅ Customer message appears once
- ✅ AI response appears once (not twice)
- ✅ Each message has correct timestamp

**Before fix:** AI message appeared twice
**After fix:** AI message appears once

## Test 3: AI Response Still Works

**Goal**: Verify AI processing happens in background

### Steps:
1. Send: `whatsapp/examples/product-question.bru`
2. Immediately check conversations page
3. Wait 5-30 seconds
4. Refresh the page

**Expected Results:**
- ✅ Customer message appears immediately
- ✅ "AI is typing" indicator shows (if you're fast enough)
- ✅ AI response appears after 5-30 seconds
- ✅ Response content is relevant to the question

## Test 4: Multiple Messages

**Goal**: Verify system handles concurrent messages

### Steps:
1. Send multiple messages rapidly (3-5 messages)
   - Use different example requests
   - Wait ~1 second between each
2. Check conversations page after 30 seconds

**Expected Results:**
- ✅ All customer messages stored
- ✅ All AI responses generated
- ✅ No duplicates
- ✅ Responses match questions

## Test 5: Error Handling

**Goal**: Verify graceful failure

### Steps:
1. Temporarily stop the AI service (or wait for rate limit)
2. Send a message
3. Check conversations page

**Expected Results:**
- ✅ Webhook still returns 200 OK fast
- ✅ Customer message still stored
- ✅ System retries AI processing
- ✅ Conversation shows timeout error if needed

## Monitoring in Convex Dashboard

While testing, open your Convex dashboard:

1. Go to "Functions" tab
2. Watch for scheduled functions:
   - `ai/process:processAndRespond`
3. Check "Logs" tab for:
   - "Scheduled AI processing for conversation..."
   - "[processAndRespond] Completed for conversation..."

**Good signs:**
- Functions execute within 5-30 seconds
- No errors in logs
- Processing state cleared properly

**Red flags:**
- Functions stuck in "running" state
- Repeated errors
- Processing state never cleared

## Troubleshooting

### Issue: Webhook times out
**Check:**
- Convex backend is running
- No syntax errors in code
- Environment variables set

### Issue: AI not responding
**Check:**
- OpenAI API key configured
- Convex logs for errors
- Rate limits not exceeded

### Issue: Messages still duplicated
**Check:**
- Code changes deployed
- Convex functions updated
- Using latest code version

## Success Criteria

All tests pass when:
- ✅ Webhooks respond in < 500ms
- ✅ No duplicate messages
- ✅ AI responses work correctly
- ✅ System handles errors gracefully
- ✅ Multiple messages processed correctly

## Next Steps After Testing

If all tests pass:
1. Test in production with real WhatsApp numbers
2. Monitor for 24 hours
3. Check for any edge cases
4. Scale test with higher volume (optional)

If tests fail:
1. Check Convex logs for errors
2. Verify code changes deployed
3. Check environment variables
4. Review console errors in browser
