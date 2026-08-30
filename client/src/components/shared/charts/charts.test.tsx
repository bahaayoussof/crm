import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CANONICAL_STATUS_ORDER,
  CANONICAL_PRIORITY_ORDER,
  getStatusChartColor,
  getSlaChartColor,
  getPriorityChartColor,
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartEmptyState,
  ChartSkeleton,
} from "./index";

describe("Chart Theme System", () => {
  it("exports canonical status and priority orders", () => {
    expect(CANONICAL_STATUS_ORDER).toEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_CUSTOMER",
      "ESCALATED",
      "RESOLVED",
      "CLOSED",
    ]);
    expect(CANONICAL_PRIORITY_ORDER).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
  });

  it("resolves semantic CSS variables for statuses", () => {
    expect(getStatusChartColor("NEW")).toBe("#06B6D4");
    expect(getStatusChartColor("OPEN")).toBe("var(--info)");
    expect(getStatusChartColor("IN_PROGRESS")).toBe("var(--progress)");
    expect(getStatusChartColor("WAITING_CUSTOMER")).toBe("var(--warning)");
    expect(getStatusChartColor("RESOLVED")).toBe("var(--success)");
    expect(getStatusChartColor("ESCALATED")).toBe("var(--danger)");
    expect(getStatusChartColor("CLOSED")).toBe("var(--muted-foreground)");
  });

  it("resolves semantic CSS variables for SLA states", () => {
    expect(getSlaChartColor("ON_TRACK")).toBe("var(--success)");
    expect(getSlaChartColor("AT_RISK")).toBe("var(--warning)");
    expect(getSlaChartColor("BREACHED")).toBe("var(--danger)");
  });

  it("resolves semantic CSS variables for priorities", () => {
    expect(getPriorityChartColor("LOW")).toBe("var(--info)");
    expect(getPriorityChartColor("HIGH")).toBe("var(--warning)");
    expect(getPriorityChartColor("URGENT")).toBe("var(--danger)");
  });
});

describe("Chart Empty State & Skeleton", () => {
  it("renders empty state with title and description", () => {
    render(<ChartEmptyState title="No activity" description="No tickets in this period" />);
    expect(screen.getByText("No activity")).toBeInTheDocument();
    expect(screen.getByText("No tickets in this period")).toBeInTheDocument();
  });

  it("renders chart skeleton", () => {
    const { container } = render(<ChartSkeleton height={200} />);
    expect(container.firstChild).toHaveStyle({ height: "200px" });
  });
});

describe("Chart Tooltip Content", () => {
  it("returns null when inactive or empty payload", () => {
    const { container: inactive } = render(<ChartTooltipContent active={false} payload={[{ name: "Open", value: 10 }]} />);
    expect(inactive.firstChild).toBeNull();

    const { container: empty } = render(<ChartTooltipContent active={true} payload={[]} />);
    expect(empty.firstChild).toBeNull();
  });

  it("renders active tooltip with formatted values", () => {
    render(
      <ChartTooltipContent
        active={true}
        label="May 2026"
        payload={[
          { name: "Created", value: 42, color: "var(--chart-1)", dataKey: "created" },
          { name: "Resolved", value: 38, color: "var(--chart-2)", dataKey: "resolved" },
        ]}
      />
    );
    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
  });

  it("supports custom formatter callback", () => {
    render(
      <ChartTooltipContent
        active={true}
        payload={[{ name: "SLA Rate", value: 94.5, color: "var(--success)" }]}
        formatter={(val) => [`${val}%`, "Compliance"]}
      />
    );
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("94.5%")).toBeInTheDocument();
  });
});

describe("Chart Legend Content", () => {
  it("renders items with swatches and values", () => {
    render(
      <ChartLegendContent
        payload={[
          { value: "Created Tickets", color: "var(--chart-1)", id: "created" },
          { value: "Resolved Tickets", color: "var(--chart-2)", id: "resolved" },
        ]}
      />
    );
    expect(screen.getByText("Created Tickets")).toBeInTheDocument();
    expect(screen.getByText("Resolved Tickets")).toBeInTheDocument();
  });
});

describe("Chart Container", () => {
  it("renders container with accessibility region role and test id", () => {
    render(
      <ChartContainer label="Ticket volume" testId="test-chart" height={240}>
        <div data-testid="inner-chart">Chart content</div>
      </ChartContainer>
    );
    const region = screen.getByRole("region", { name: "Ticket volume" });
    expect(region).toBeInTheDocument();
    expect(screen.getByTestId("test-chart")).toBeInTheDocument();
  });
});
