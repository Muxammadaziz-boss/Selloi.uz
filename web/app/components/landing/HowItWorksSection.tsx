"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface HowItWorksSectionProps {
  t: SelloiTranslations["qandayIshlaydi"];
}

export default function HowItWorksSection({ t }: HowItWorksSectionProps) {
  return (
    <section className="selloi-how-section selloi-reveal-item" id="qanday-ishlaydi" data-node-id="182:351">
      <div className="selloi-container">
        {/* Category Tag */}
        <p className="selloi-section-tag" data-node-id="182:352">
          {t.tag}
        </p>

        {/* Section Title */}
        <h2 className="selloi-how-title" data-node-id="182:353">
          {t.title}
        </h2>

        {/* 3 Steps Grid */}
        <div className="selloi-how-grid">
          {/* Step 01 */}
          <div className="selloi-how-step" data-node-id="182:354">
            <div className="selloi-how-line" data-node-id="182:355" />
            <p className="selloi-how-num" data-node-id="182:356">
              {t.step1Num}
            </p>
            <h3 className="selloi-how-heading" data-node-id="182:357">
              {t.step1Title}
            </h3>
            <p className="selloi-how-desc" data-node-id="182:358">
              {t.step1DescLine1}
              <br />
              {t.step1DescLine2}
            </p>
          </div>

          {/* Step 02 */}
          <div className="selloi-how-step" data-node-id="182:359">
            <div className="selloi-how-line" data-node-id="182:360" />
            <p className="selloi-how-num" data-node-id="182:361">
              {t.step2Num}
            </p>
            <h3 className="selloi-how-heading" data-node-id="182:362">
              {t.step2Title}
            </h3>
            <p className="selloi-how-desc" data-node-id="182:363">
              {t.step2DescLine1}
              <br />
              {t.step2DescLine2}
            </p>
          </div>

          {/* Step 03 */}
          <div className="selloi-how-step" data-node-id="182:364">
            <div className="selloi-how-line" data-node-id="182:365" />
            <p className="selloi-how-num" data-node-id="182:366">
              {t.step3Num}
            </p>
            <h3 className="selloi-how-heading" data-node-id="182:367">
              {t.step3Title}
            </h3>
            <p className="selloi-how-desc" data-node-id="182:368">
              {t.step3DescLine1}
              <br />
              {t.step3DescLine2}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
