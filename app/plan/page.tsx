"use client";

import { PlanDoc } from "@/components/print/PlanDoc";
import { PrintBar } from "@/components/print/PrintBar";

/** The workshop plan for the whole hour: printable, with the group's own details typed in place. */
export default function PlanPage() {
  return (
    <div className="guide min-h-dvh bg-[#d8dbe8] py-4">
      <PrintBar title="Workshop plan" here="/plan" hint="A4 portrait, margins: none, background graphics: on. For the Moodle upload use “Everything in one PDF”, which includes this plan." />
      <PlanDoc />
    </div>
  );
}
