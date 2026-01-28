# Bruno API Testing Collection

This collection allows you to simulate WhatsApp messages from test customers without needing a physical phone.

## Setup

1. **Install Bruno** - Download from [usebruno.com](https://www.usebruno.com/)

2. **Open Collection** - In Bruno, open this folder (`bruno/`)

3. **Configure Environment Variables**
   - Open `environments/local.bru`
   - Update the following variables:

   ```
   CONVEX_SITE_URL: https://careful-mandrill-967.convex.site  # Your Convex site URL
   BUSINESS_PHONE: +14155238886                                # Business WhatsApp number from your DB
   CUSTOMER_PHONE: +15555551234                                # Any test phone number you want
   ```

   **Where to find `BUSINESS_PHONE`:**
   - Open Convex Dashboard
   - Go to `whatsappConnections` table
   - Copy the `phoneNumber` field value

4. **Select Environment**
   - In Bruno, select "local" from the environment dropdown

## Usage

### Sending a Message

1. Navigate to `whatsapp/send-message.bru`
2. Edit the `Body` field with your message
3. Click "Send"
4. Open your Echo conversations page to see the message and AI response

### Example Requests

Pre-made examples in `whatsapp/examples/`:

- **greeting.bru** - Spanish greeting
- **product-question.bru** - Ask about products
- **start-order.bru** - Place an order
- **ask-for-human.bru** - Escalation request

Each example can be edited and sent as-is.

### Testing Different Customers

To simulate different customers, change the `CUSTOMER_PHONE` variable in the environment.

Each phone number will create a new customer and conversation in your system.

### Multi-turn Conversations

To test a conversation flow:
1. Send first message
2. Wait a few seconds for AI to respond
3. Check conversations page
4. Send follow-up message
5. Repeat

## How It Works

- Each request simulates a Twilio WhatsApp webhook
- Messages are sent to your Convex webhook endpoint
- The system processes them like real WhatsApp messages
- AI responds automatically
- View results in your conversations dashboard

## Notes

- All requests return `200 OK` if successful
- The `MessageSid` is auto-generated to be unique
- No need to check Bruno responses - use your conversations page instead
- The system auto-creates customers and conversations as needed
