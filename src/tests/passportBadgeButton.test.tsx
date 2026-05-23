import { fireEvent, render, screen, within } from "@testing-library/react";
import { PassportBadgeButton } from "../features/passport/components/PassportBadgeButton";
import { usePassportStore } from "../features/passport/usePassportStore";
import { createPassportData } from "../features/passport/passport.utils";
import type { PassportProfile } from "../features/passport/passport.types";

const FULL_PROFILE: PassportProfile = {
  communicationStyle: "structured",
  tone: "professional",
  focusArea: "startup",
};

function resetStore(): void {
  usePassportStore.setState({
    passport: null,
    flowStep: "welcome",
    draft: {},
    isGenerating: false,
    isReeditingPassport: false,
  });
  localStorage.clear();
}

describe("PassportBadgeButton configuration UI", () => {
  beforeEach(resetStore);

  it("existing users can still create Passport from the sidebar CTA", () => {
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Create AI Passport" }));

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe("welcome");
  });

  it("existing users can edit Passport after creation", () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI Passport" }));
    const dialog = screen.getByRole("dialog", { name: "Your AI Passport" });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit Passport" }),
    );

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe("welcome");
  });

  it("sidebar panel keeps Passport actions visible after creation", () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole("button", { name: "Open AI Passport" }));
    const dialog = screen.getByRole("dialog", { name: "Your AI Passport" });

    expect(
      within(dialog).getByRole("button", { name: "Copy Passport" }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", { name: "Attach to next export" }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", { name: "Edit Passport" }),
    ).toBeInTheDocument();
  });
});
