import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import { TicketReplyLinkPopover } from "./ticket-reply-link-popover";
import { validateLinkUrl, type LinkPopoverData } from "./ticket-reply-link.utils";

describe("validateLinkUrl", () => {
  it("rejects empty / whitespace URLs with urlRequired error", () => {
    expect(validateLinkUrl("")).toEqual({ valid: false, errorKey: "urlRequired" });
    expect(validateLinkUrl("   ")).toEqual({ valid: false, errorKey: "urlRequired" });
  });

  it("rejects dangerous URI schemes (javascript, data, vbscript, file)", () => {
    expect(validateLinkUrl("javascript:alert(1)")).toEqual({ valid: false, errorKey: "invalidUrl" });
    expect(validateLinkUrl("data:text/html,<h1>bad</h1>")).toEqual({ valid: false, errorKey: "invalidUrl" });
    expect(validateLinkUrl("vbscript:msgbox(1)")).toEqual({ valid: false, errorKey: "invalidUrl" });
    expect(validateLinkUrl("file:///etc/passwd")).toEqual({ valid: false, errorKey: "invalidUrl" });
  });

  it("accepts valid https and http URLs", () => {
    expect(validateLinkUrl("https://example.com")).toEqual({ valid: true, normalizedUrl: "https://example.com" });
    expect(validateLinkUrl("http://localhost:3000/path?query=1")).toEqual({
      valid: true,
      normalizedUrl: "http://localhost:3000/path?query=1",
    });
  });

  it("normalizes scheme-less domain URLs by prefixing https://", () => {
    expect(validateLinkUrl("example.com")).toEqual({ valid: true, normalizedUrl: "https://example.com" });
    expect(validateLinkUrl("sub.domain.org/docs")).toEqual({ valid: true, normalizedUrl: "https://sub.domain.org/docs" });
  });

  it("accepts valid mailto: and tel: URLs", () => {
    expect(validateLinkUrl("mailto:support@crm.azm")).toEqual({ valid: true, normalizedUrl: "mailto:support@crm.azm" });
    expect(validateLinkUrl("tel:+1234567890")).toEqual({ valid: true, normalizedUrl: "tel:+1234567890" });
  });

  it("rejects malformed mailto: and tel: URLs", () => {
    expect(validateLinkUrl("mailto:")).toEqual({ valid: false, errorKey: "invalidUrl" });
    expect(validateLinkUrl("mailto:invalid")).toEqual({ valid: false, errorKey: "invalidUrl" });
    expect(validateLinkUrl("tel:")).toEqual({ valid: false, errorKey: "invalidUrl" });
  });
});

describe("TicketReplyLinkPopover Component", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
  });

  const dummyTrigger = { current: document.createElement("button") };

  const defaultInitialData: LinkPopoverData = {
    url: "",
    text: "Selected Text",
    openInNewTab: true,
    isExisting: false,
  };

  it("renders when open is true", () => {
    render(
      <TicketReplyLinkPopover
        open={true}
        triggerRef={dummyTrigger}
        initialData={defaultInitialData}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveValue("Selected Text");
    expect(screen.getByLabelText("Open link in new tab")).toBeChecked();
    expect(screen.getByRole("button", { name: "Insert" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(
      <TicketReplyLinkPopover
        open={false}
        triggerRef={dummyTrigger}
        initialData={defaultInitialData}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits normalized URL and user-provided text", () => {
    const submitSpy = vi.fn();
    render(
      <TicketReplyLinkPopover
        open={true}
        triggerRef={dummyTrigger}
        initialData={defaultInitialData}
        onSubmit={submitSpy}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "google.com" } });
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Google Search" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(submitSpy).toHaveBeenCalledWith({
      url: "https://google.com",
      text: "Google Search",
      openInNewTab: true,
    });
  });

  it("shows Remove link button when editing an existing link and invokes onRemove", () => {
    const removeSpy = vi.fn();
    const existingData: LinkPopoverData = {
      url: "https://example.com",
      text: "Existing Link",
      openInNewTab: false,
      isExisting: true,
    };

    render(
      <TicketReplyLinkPopover
        open={true}
        triggerRef={dummyTrigger}
        initialData={existingData}
        onSubmit={vi.fn()}
        onRemove={removeSpy}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    const removeBtn = screen.getByRole("button", { name: "Remove link" });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
