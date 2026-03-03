import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";

const originalFetch = global.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("HomePage", () => {
  beforeAll(() => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:preview-url");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("shows validation error for unsupported image type", async () => {
    render(<HomePage />);

    const input = screen.getByLabelText(/upload portrait image/i) as HTMLInputElement;
    const badFile = new File([new Uint8Array([1, 2, 3])], "portrait.gif", { type: "image/gif" });

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(await screen.findByText("Please upload JPG, PNG, or WebP only.")).toBeInTheDocument();
  });

  it("moves to result screen after successful transform", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: "test-id",
        status: "completed",
        outputImageUrl: "data:image/png;base64,ZmFrZQ==",
        meta: {
          provider: "gemini",
          durationMs: 2200,
          model: "gemini-2.5-flash-image"
        }
      })
    }) as unknown as typeof fetch;

    render(<HomePage />);

    const input = screen.getByLabelText(/upload portrait image/i) as HTMLInputElement;
    const validFile = new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [validFile] } });

    fireEvent.click(screen.getByRole("button", { name: /transform portrait/i }));

    await waitFor(() => {
      expect(screen.getByText("Your transformed portrait")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /download image/i })).toBeInTheDocument();
  });
});
