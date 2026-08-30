import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { FileUploadModal } from "./file-upload-modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { size?: string }) => {
      const translations: Record<string, string> = {
        "attachments.selectFile": "Upload file",
        "attachments.uploadFile": "Upload file",
        "attachments.chooseFile": "Choose file",
        "attachments.dragDropHint": "Drag and drop your file here",
        "attachments.dragDropOr": "or",
        "attachments.dragActive": "Drop file to select",
        "attachments.acceptedTypes": "Accepted types: JPEG, PNG, WebP, PDF, plain text",
        "attachments.maxSize": `Maximum size: ${options?.size ?? "4 MiB"}`,
        "attachments.selectedFile": "Selected file",
        "attachments.removeFile": "Remove file",
        "attachments.uploadShort": "Upload",
        "attachments.uploadPending": "Uploading…",
        "attachments.cancel": "Cancel",
        "attachments.closePreview": "Close",
        "attachments.uploadFailure": "Unable to upload the attachment.",
        "attachments.errors.EMPTY_FILE": "The file is empty.",
        "attachments.errors.FILE_TOO_LARGE": "The file exceeds the maximum size of 4 MiB.",
        "attachments.errors.UNSUPPORTED_FILE_TYPE": "This file type is not allowed.",
        "attachments.errors.NO_FILE": "Select a file to upload.",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

describe("FileUploadModal", () => {
  const onOpenChange = vi.fn();
  const onUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when open is false", () => {
    render(
      <FileUploadModal
        open={false}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal with header, dropzone, and constraints when open is true", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Upload file")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop your file here")).toBeInTheDocument();
    expect(screen.getByText("Choose file")).toBeInTheDocument();
    expect(screen.getByText(/Accepted types: JPEG, PNG, WebP, PDF, plain text/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum size: 4 MiB/)).toBeInTheDocument();

    const uploadButton = screen.getByRole("button", { name: /upload/i });
    expect(uploadButton).toBeDisabled();
  });

  it("handles valid file selection via file input", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const file = new File(["test-content"], "document.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("Selected file")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getAllByText(/PDF/).length).toBeGreaterThan(0);

    const uploadButton = screen.getByRole("button", { name: /upload/i });
    expect(uploadButton).not.toBeDisabled();
  });

  it("handles drag-and-drop file upload", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const dropzone = screen.getByRole("button", { name: /choose file/i });
    const file = new File(["image-bytes"], "screenshot.png", { type: "image/png" });

    // Drag enter
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        items: [{ kind: "file", type: "image/png" }],
        types: ["Files"],
      },
    });
    expect(screen.getByText("Drop file to select")).toBeInTheDocument();

    // Drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(screen.getByText("Selected file")).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
  });

  it("rejects unsupported file type and shows validation error", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const file = new File(["exe-content"], "malware.exe", { type: "application/x-msdownload" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole("alert")).toHaveTextContent("This file type is not allowed.");
    expect(screen.queryByText("Selected file")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
  });

  it("rejects oversized file (> 4 MiB) and shows error", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const bigFile = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(screen.getByRole("alert")).toHaveTextContent("The file exceeds the maximum size of 4 MiB.");
    expect(screen.queryByText("Selected file")).not.toBeInTheDocument();
  });

  it("rejects empty file (0 bytes)", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const emptyFile = new File([], "empty.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [emptyFile] } });

    expect(screen.getByRole("alert")).toHaveTextContent("The file is empty.");
  });

  it("removes selected file when remove button is clicked", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const file = new File(["test-content"], "document.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("document.pdf")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: "Remove file" });
    fireEvent.click(removeButton);

    expect(screen.queryByText("document.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected file")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
  });

  it("executes upload and closes modal upon success", async () => {
    onUpload.mockResolvedValueOnce({ success: true });

    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const file = new File(["test"], "sample.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const uploadButton = screen.getByRole("button", { name: "Upload" });
    fireEvent.click(uploadButton);

    expect(onUpload).toHaveBeenCalledWith(file);
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays error on upload failure and allows retry without clearing file", async () => {
    onUpload.mockRejectedValueOnce(new Error("Network failure"));

    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const file = new File(["test"], "sample.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const uploadButton = screen.getByRole("button", { name: "Upload" });
    fireEvent.click(uploadButton);

    expect(onUpload).toHaveBeenCalledWith(file);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to upload the attachment.");
    });
    // File remains selected so user can retry
    expect(screen.getByText("sample.pdf")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes modal and calls onOpenChange(false) when Cancel is clicked", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes modal on Escape key press", () => {
    render(
      <FileUploadModal
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
