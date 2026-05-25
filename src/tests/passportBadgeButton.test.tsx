import { fireEvent, render, screen } from "@testing-library/react";
import { PassportBadgeButton } from "../features/passport/components/PassportBadgeButton";
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

describe("PassportBadgeButton — sidebar navigation behaviour", () => {
  beforeEach(resetStores);

  it("no-passport state: clicking 'Create AI Passport' starts the edit flow", () => {
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Create AI Passport" }));

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe("welcome");
  });

  it("no-passport state: invokes onNavigate after starting the flow", () => {
    const onNavigate = jest.fn();
    render(<PassportBadgeButton onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Create AI Passport" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("with-passport state: clicking 'Open AI Passport' navigates to the Passport page", () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI Passport" }));

    expect(useProjectStore.getState().currentView).toBe("passport");
  });

  it("with-passport state: invokes onNavigate after navigating", () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    const onNavigate = jest.fn();
    render(<PassportBadgeButton onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI Passport" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().currentView).toBe("passport");
  });

  it("does NOT open an inline dialog/panel when the badge is clicked", () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI Passport" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("badge shows the AI Passport identity label and short ID", () => {
    const passport = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport });
    render(<PassportBadgeButton />);

    expect(screen.getByText("AI Passport")).toBeInTheDocument();
    const expectedShortId = passport.id.split("-").slice(1, 3).join("-");
    expect(screen.getByText(expectedShortId)).toBeInTheDocument();
  });
});
