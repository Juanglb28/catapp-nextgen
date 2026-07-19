import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MoneyInput } from "./money-input";

function Harness() {
  const [value, setValue] = useState(0);
  return (
    <>
      <MoneyInput value={value} onChange={setValue} aria-label="precio" />
      <span data-testid="raw">{value}</span>
    </>
  );
}

function getInput() {
  return screen.getByLabelText("precio") as HTMLInputElement;
}

describe("MoneyInput", () => {
  it("arranca vacío con valor 0", () => {
    render(<Harness />);
    expect(getInput().value).toBe("");
    expect(screen.getByTestId("raw").textContent).toBe("0");
  });

  it("formatea es-CO mientras se escribe y entrega el entero", () => {
    render(<Harness />);
    fireEvent.change(getInput(), { target: { value: "50000" } });
    expect(screen.getByTestId("raw").textContent).toBe("50000");
    expect(getInput().value).toBe("$50.000");
  });

  it("ignora caracteres no numéricos", () => {
    render(<Harness />);
    fireEvent.change(getInput(), { target: { value: "abc123" } });
    expect(screen.getByTestId("raw").textContent).toBe("123");
    expect(getInput().value).toBe("$123");
  });

  it("reformatea al seguir escribiendo sobre el valor formateado", () => {
    render(<Harness />);
    fireEvent.change(getInput(), { target: { value: "$50.0000" } });
    expect(screen.getByTestId("raw").textContent).toBe("500000");
    expect(getInput().value).toBe("$500.000");
  });

  it("vuelve a vacío al borrar todo", () => {
    render(<Harness />);
    fireEvent.change(getInput(), { target: { value: "50000" } });
    fireEvent.change(getInput(), { target: { value: "" } });
    expect(screen.getByTestId("raw").textContent).toBe("0");
    expect(getInput().value).toBe("");
  });
});
