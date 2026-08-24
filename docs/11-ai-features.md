# AI Features

AI is an enhancement layer, not a dependency for the core CRM.

## Priority

### P2
1. Ticket summary
2. Suggested reply
3. Automatic categorization
4. Suggested knowledge-base solution

### P3
5. AI chatbot

## Provider

No provider is fixed.

Provider integration must be isolated behind an application service so the rest of the CRM does not depend directly on one vendor SDK.

Example conceptual interface:

```ts
interface AiAssistant {
  summarizeTicket(input: TicketContext): Promise<string>;
  suggestReply(input: TicketContext): Promise<string>;
  categorizeTicket(input: TicketContext): Promise<string>;
}
```

## Safety and UX

- AI output is a suggestion.
- Agents review suggested replies before sending.
- Do not automatically change ticket category or send a customer response without explicit product approval.
- If provider access is unavailable, the rest of the CRM must continue to work.
