import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleContent } from "./knowledge-article-content";

describe("ArticleContent", () => {
  afterEach(cleanup);

  it("renders rich HTML formatted (headings, lists, emphasis, links)", () => {
    const { container } = render(
      <ArticleContent content='<h2>Set up</h2><p>Do <strong>this</strong>.</p><ul><li>step</li></ul><p><a href="https://example.com">docs</a></p>' />,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Set up");
    expect(container.querySelector("strong")?.textContent).toBe("this");
    expect(container.querySelector("ul li")?.textContent).toBe("step");
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("strips scripts, event handlers, javascript: links and images but keeps text", () => {
    const { container } = render(
      <ArticleContent
        content={
          '<p onclick="steal()">Visible text</p><script>alert(1)</script>' +
          '<a href="javascript:alert(1)">bad</a><img src="x" onerror="y()">'
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getByText(/Visible text/)).toBeInTheDocument();
  });

  it("renders a legacy plain-text body via the whitespace-pre-wrap path with dir=auto", () => {
    const { container } = render(
      <ArticleContent content={"Step one.\n\nStep two <not a tag> stays literal."} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("whitespace-pre-wrap");
    expect(el).toHaveAttribute("dir", "auto");
    expect(el.querySelector("*")).toBeNull(); // pure text node, no injected markup
    expect(el.textContent).toContain("Step two <not a tag> stays literal.");
  });
});
