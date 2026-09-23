"use client";

import { useState } from "react";
import NavBar from "./NavBar";
import ChatPanel from "./ChatPanel";

export default function ClientShell() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <>
      <NavBar onChatOpen={() => setChatOpen(true)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
