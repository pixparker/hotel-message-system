import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Page } from "../../components/Page.js";
import { Stepper } from "../../components/Stepper.js";
import { useWizard } from "../../state/wizard.js";
import { Step1Template } from "./step-1-template.js";
import { Step2Languages } from "./step-2-languages.js";
import { Step3Recipients } from "./step-3-recipients.js";
import { Step4Test } from "./step-4-test.js";
import { Step5Confirm } from "./step-5-confirm.js";

const STEPS = [
  "Recipients",
  "Message",
  "Languages",
  "Test",
  "Send",
];

export function SendWizardPage() {
  const navigate = useNavigate();
  const step = useWizard((s) => s.step);
  const reset = useWizard((s) => s.reset);

  const current = Math.max(1, Math.min(5, step));

  return (
    <Page
      title="Send message"
      description="Compose, preview, and send in a few quick steps."
      actions={
        <button
          className="btn-ghost"
          onClick={() => {
            reset();
            navigate("/send");
          }}
        >
          Start over
        </button>
      }
    >
      <div className="card p-4 mb-6">
        <Stepper steps={STEPS} current={current} />
      </div>

      <Routes>
        <Route index element={<Step3Recipients />} />
        <Route path="message" element={<Step1Template />} />
        <Route path="languages" element={<Step2Languages />} />
        <Route path="test" element={<Step4Test />} />
        <Route path="confirm" element={<Step5Confirm />} />
        <Route path="*" element={<Navigate to="/send" replace />} />
      </Routes>
    </Page>
  );
}
