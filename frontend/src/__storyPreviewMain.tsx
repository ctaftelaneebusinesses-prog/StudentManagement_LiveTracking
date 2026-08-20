import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { StoryCarousel } from "./pages/portal/components/story/StoryCarousel";
import { SchoolContext } from "./context/SchoolContext";
import "./index.css";

const FAKE_SCHOOL = {
  id: "fake-school-id",
  name: "Sunrise Valley International School",
  code: "SVIS",
  branch_name: null,
  principal_name: null,
  address: null,
  phone: null,
  alternate_phone: null,
  email: null,
  city: null,
  district: null,
  state: null,
  pin_code: null,
  country: null,
  logo_url: null,
  settings: {},
  is_active: true,
};

function PreviewRoot() {
  const [dark, setDark] = useState(false);
  return (
    <SchoolContext.Provider
      value={{
        schools: [FAKE_SCHOOL],
        selectedSchool: FAKE_SCHOOL,
        setSelectedSchoolId: () => {},
        canSwitchSchools: false,
      }}
    >
      <div className={dark ? "dark" : ""}>
        <div data-portal-theme="boy" style={{ background: dark ? "#0d0d0d" : "#f8fafc", padding: 24, minHeight: "100vh" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, fontFamily: "sans-serif" }}>
            <button onClick={() => setDark((d) => !d)}>Toggle dark ({dark ? "on" : "off"})</button>
          </div>
          <div style={{ maxWidth: 900 }}>
            <StoryCarousel />
          </div>
        </div>
      </div>
    </SchoolContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewRoot />
  </StrictMode>
);
