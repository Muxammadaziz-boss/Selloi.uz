"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface FeaturesSectionProps {
  t: SelloiTranslations["imkoniyatlar"];
}

export default function FeaturesSection({ t }: FeaturesSectionProps) {
  return (
    <section className="selloi-imkoniyatlar-section selloi-reveal-item" id="imkoniyatlar" data-node-id="182:323">
      <div className="selloi-container">
        {/* Category Tag */}
        <p className="selloi-section-tag" data-node-id="182:324">
          {t.tag}
        </p>

        {/* Section Header */}
        <div className="selloi-imkoniyatlar-header">
          <h2 className="selloi-imkoniyatlar-title" data-node-id="182:325">
            {t.titleLine1}
            <br />
            {t.titleLine2}
          </h2>
          <p className="selloi-imkoniyatlar-desc" data-node-id="182:326">
            {t.subtitleLine1}
            <br />
            {t.subtitleLine2}
          </p>
        </div>

        {/* Cards Grid */}
        <div className="selloi-imkoniyatlar-grid">
          {/* Card 01 (Left Tall Card) */}
          <div className="selloi-card-tall" data-node-id="182:327">
            <p className="selloi-card-tag" data-node-id="182:328">
              {t.card1Tag}
            </p>
            <h3 className="selloi-card-tall-title" data-node-id="182:329">
              {t.card1TitleLine1}
              <br />
              {t.card1TitleLine2}
            </h3>
            <p className="selloi-card-tall-desc" data-node-id="182:330">
              {t.card1DescLine1}
              <br />
              {t.card1DescLine2}
            </p>

            {/* Inner Chat Box Preview */}
            <div className="selloi-card-chat-preview" data-node-id="182:331">
              <div>
                <p className="selloi-chat-customer-label" data-node-id="182:332">
                  {t.card1UserLabel}
                </p>
                <p className="selloi-chat-customer-msg" data-node-id="182:333">
                  {t.card1UserMsg}
                </p>
              </div>

              <div className="selloi-chat-bot-bubble" data-node-id="182:334">
                <p className="selloi-chat-bot-label" data-node-id="182:335">
                  {t.card1BotLabel}
                </p>
                <p className="selloi-chat-bot-msg" data-node-id="182:336">
                  {t.card1BotMsgLine1}
                  <br />
                  {t.card1BotMsgLine2}
                </p>
              </div>
            </div>
          </div>

          {/* Right Stacked Cards */}
          <div className="selloi-cards-stacked">
            {/* Card 02 */}
            <div className="selloi-card-small" data-node-id="182:337">
              <p className="selloi-card-tag" data-node-id="182:338">
                {t.card2Tag}
              </p>
              <h3 className="selloi-card-small-title" data-node-id="182:339">
                {t.card2Title}
              </h3>
              <p className="selloi-card-small-desc" data-node-id="182:340">
                {t.card2DescLine1}
                <br />
                {t.card2DescLine2}
              </p>
            </div>

            {/* Card 03 */}
            <div className="selloi-card-small" data-node-id="182:341">
              <p className="selloi-card-tag" data-node-id="182:342">
                {t.card3Tag}
              </p>
              <h3 className="selloi-card-small-title" data-node-id="182:343">
                {t.card3Title}
              </h3>
              <p className="selloi-card-small-desc" data-node-id="182:344">
                {t.card3DescLine1}
                <br />
                {t.card3DescLine2}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
