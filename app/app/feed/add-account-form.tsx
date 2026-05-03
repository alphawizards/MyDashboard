"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type FormState = "idle" | "pending" | "success" | "error";

export function AddAccountForm() {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (state === "pending") return;

    const trimmedHandle = handle.trim();
    const trimmedName = name.trim();

    if (!trimmedHandle || !trimmedName) {
      setErrorMsg("Both handle and name are required.");
      setState("error");
      return;
    }

    setState("pending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/x-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: trimmedHandle, name: trimmedName }),
      });

      if (res.status === 201) {
        setState("success");
        setHandle("");
        setName("");
        router.refresh();
        setTimeout(() => setState("idle"), 2000);
      } else {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? `Request failed (HTTP ${res.status})`);
        setState("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setState("error");
    }
  }

  return (
    <form className="add-account-form" onSubmit={handleSubmit}>
      <input
        className="add-account-input"
        value={handle}
        onChange={(event) => setHandle(event.target.value)}
        placeholder="@handle"
        disabled={state === "pending"}
        required
        maxLength={50}
      />
      <input
        className="add-account-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Account name"
        disabled={state === "pending"}
        required
        maxLength={100}
      />
      <button
        type="submit"
        className="filter-btn add-account-btn"
        disabled={state === "pending"}
      >
        {state === "pending" ? "Adding..." : "Add Account"}
      </button>
      {state === "success" && (
        <span className="add-account-msg success">Account added.</span>
      )}
      {state === "error" && (
        <span className="add-account-msg error">{errorMsg}</span>
      )}
    </form>
  );
}
