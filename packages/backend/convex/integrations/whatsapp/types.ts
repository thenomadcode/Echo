/**
 * WhatsApp Business Service Provider (BSP) abstraction types
 * Enables switching between different providers (Twilio, 360dialog, Meta Cloud API, etc.)
 */

// Button for interactive messages (WhatsApp supports max 3 buttons)
export interface Button {
	id: string;
	title: string;
}

// Row item within a list section
export interface ListRow {
	id: string;
	title: string;
	description?: string;
}

// Section for list messages (product selection, menu options, etc.)
export interface ListSection {
	title: string;
	rows: ListRow[];
}

// Result from sending a message via BSP
export interface MessageResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

// Message types supported by WhatsApp Business API
export type MessageType = "text" | "image" | "voice" | "document" | "buttons" | "list";

// Delivery status types from WhatsApp/BSP webhooks
export type DeliveryStatus = "sent" | "delivered" | "read" | "failed" | "undelivered";

// Parsed status update from webhook payload
export interface StatusUpdate {
	externalId: string; // Provider's message ID (MessageSid for Twilio)
	status: DeliveryStatus;
	timestamp: number; // Unix timestamp in milliseconds
	errorCode?: string; // Error code for failed deliveries
	errorMessage?: string; // Human-readable error message
}

// Parsed incoming message from webhook payload
export interface ParsedMessage {
	from: string; // Customer phone number (e.g., +573001234567)
	content: string; // Message text or media caption
	timestamp: number; // Unix timestamp in milliseconds
	mediaUrl?: string; // URL to media file (if image/voice/document)
	mediaType?: string; // MIME type of media (e.g., image/jpeg, audio/ogg)
	messageType: MessageType;
	externalId: string; // Provider's message ID for status tracking
}

// Webhook verification result
export interface WebhookVerification {
	valid: boolean;
	challenge?: string; // Echo back for Meta webhook verification
}

// Credentials structure for providers
export interface ProviderCredentials {
	accountSid?: string; // Twilio Account SID
	authToken?: string; // Twilio Auth Token
	apiKey?: string; // Generic API key for other providers
	phoneNumberId?: string; // Meta Cloud API phone number ID
	accessToken?: string; // Meta Cloud API access token
}

/**
 * WhatsApp Provider Interface
 * All BSP implementations must implement this interface
 */
export interface WhatsAppProvider {
	/**
	 * Send a plain text message
	 * @param to - Recipient phone number in E.164 format (e.g., +573001234567)
	 * @param message - Text content to send
	 */
	sendText(to: string, message: string): Promise<MessageResult>;

	/**
	 * Send an image message with optional caption
	 * @param to - Recipient phone number
	 * @param imageUrl - Public URL to the image
	 * @param caption - Optional text caption for the image
	 */
	sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult>;

	/**
	 * Send an interactive button message (max 3 buttons per WhatsApp limit)
	 * @param to - Recipient phone number
	 * @param body - Message body text
	 * @param buttons - Array of buttons (max 3)
	 */
	sendButtons(to: string, body: string, buttons: Button[]): Promise<MessageResult>;

	/**
	 * Send a list message for product selection or menu options
	 * @param to - Recipient phone number
	 * @param body - Message body text
	 * @param sections - Array of list sections with rows
	 * @param buttonText - Text for the list button (e.g., "View Options")
	 */
	sendList(
		to: string,
		body: string,
		sections: ListSection[],
		buttonText?: string,
	): Promise<MessageResult>;

	/**
	 * Parse incoming webhook payload into standardized format
	 * @param payload - Raw webhook payload from provider
	 */
	parseWebhook(payload: unknown): ParsedMessage | null;

	/**
	 * Verify webhook signature for security
	 * @param payload - Raw webhook payload
	 * @param signature - Signature header from request
	 * @returns Verification result with challenge for Meta webhook setup
	 */
	verifyWebhook(payload: unknown, signature: string): WebhookVerification;
}
