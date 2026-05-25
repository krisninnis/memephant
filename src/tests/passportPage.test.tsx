import { fireEvent, render, screen, within } from "@testing-library/react";
import { PassportPage } from "../features/passport/components/PassportPage";
import { usePassportStore } from "../features/passport/usePassportStore";
import { useProjectStore } from "../store/projectStore";
import { createPassportData } from "../features/passport/passport.utils";
import type { PassportProfile } from "../features/passport/passport.types";

const FULL_PROFILE: PassportProfile = {
  communicationStyle: "structured",
  tone: "professional",
  focusArea: "startup",
};

function resetStores(): void {
  usePassportStore.setState({
    passport: null,
    flowStep: "welcome",
    draft: {},
    isGenerating: false,
    passportFlowSkipped: false,
    isReeditingPassport: false,
  });

  useProjectStore.setState({ currentView: "projects" });
  localStorage.clear();
}

describe("PassportPage — empty state", () => {
  beforeEach(resetStores);

  it("renders the Create AI Passport CTA when no passport exists", () => {
    render(<PassportPage />);

    expect(
      screen.getByRole("heading", { name: /Set your AI working style/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Create your AI Passport/i }),
    ).toBeInTheDocument();
  });

  it("clicking the empty-state CTA opens the edit flow", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Create your AI Passport/i }),
    );

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe("welcome");
  });
});

describe("PassportPage — details subview", () => {
  beforeEach(() => {
    resetStores();
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
  });

  it("renders the AI Passport hero, identity label, and meta row", () => {
    render(<PassportPage />);

    const region = screen.getByRole("region", { name: /AI Passport page/i });

    expect(within(region).getByText("AI Passport")).toBeInTheDocument();

    expect(
      within(region).getByRole("heading", {
        name: /Your AI working identity/i,
      }),
    ).toBeInTheDocument();

    const passport = usePassportStore.getState().passport!;
    expect(
      within(region).getByText(new RegExp(passport.id)),
    ).toBeInTheDocument();
  });

  it("shows the three working-style facets — Style, Tone, Focus", () => {
    render(<PassportPage />);

    expect(screen.getByText("Style")).toBeInTheDocument();
    expect(screen.getByText("Tone")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByText("Structured")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Startup")).toBeInTheDocument();
  });

  it("shows the three main action buttons: Copy / Edit / See the Difference", () => {
    render(<PassportPage />);

    expect(
      screen.getByRole("button", { name: /Copy AI Passport to clipboard/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Edit your AI Passport/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /See the difference your AI Passport makes/i,
      }),
    ).toBeInTheDocument();
  });

  it("clicking Edit Passport calls startPassportEdit", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Edit your AI Passport/i }),
    );

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe("welcome");
    expect(usePassportStore.getState().passport).toBeNull();
  });

  it("clicking See the Difference switches to the simulator subview", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /See the difference your AI Passport makes/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: /See how your Passport changes the way AI responds/i,
      }),
    ).toBeInTheDocument();
  });

  it("Back from the simulator returns to the details subview", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /See the difference your AI Passport makes/i,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Back to Passport/i }));

    expect(
      screen.getByRole("heading", { name: /Your AI working identity/i }),
    ).toBeInTheDocument();
  });

  it("shows the local-first / privacy callout", () => {
    render(<PassportPage />);

    expect(
      screen.getByRole("heading", { name: /Local-first by design/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/stored on this device only/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Memory Trail/i).length).toBeGreaterThan(0);
  });

  it("Copy Passport writes the identity-first attachment text to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Copy AI Passport to clipboard/i }),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("# AI Passport");
    expect(copied).not.toContain("currentState");
    expect(copied).not.toContain("nextSteps");
  });
});

describe("PassportPage — Delete Passport", () => {
  beforeEach(() => {
    resetStores();
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
  });

  it("shows a Delete Passport action on the Passport page", () => {
    render(<PassportPage />);

    expect(
      screen.getByRole("heading", { name: /Delete Passport/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Delete AI Passport/i }),
    ).toBeInTheDocument();
  });

  it("clicking Delete Passport shows a confirmation prompt", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Delete AI Passport/i }),
    );

    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Cancel deleting AI Passport/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Confirm delete AI Passport/i }),
    ).toBeInTheDocument();
  });

  it("cancelling Delete Passport keeps the Passport", () => {
    render(<PassportPage />);

    const existingPassport = usePassportStore.getState().passport;

    fireEvent.click(
      screen.getByRole("button", { name: /Delete AI Passport/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Cancel deleting AI Passport/i }),
    );

    expect(usePassportStore.getState().passport).toEqual(existingPassport);

    expect(
      screen.getByRole("heading", { name: /Your AI working identity/i }),
    ).toBeInTheDocument();
  });

  it("confirming Delete Passport removes the Passport and returns to empty state", () => {
    render(<PassportPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Delete AI Passport/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Confirm delete AI Passport/i }),
    );

    expect(usePassportStore.getState().passport).toBeNull();

    expect(
      screen.getByRole("heading", { name: /Set your AI working style/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Create your AI Passport/i }),
    ).toBeInTheDocument();
  });
});
