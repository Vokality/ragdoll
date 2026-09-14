# @vokality/ragdoll-extension-flash-cards

Flash cards extension for Ragdoll. Provides deck/card tools and a typed-answer review slot with simple spaced repetition.

When a review finishes (last rating or End), the extension publishes a `review.completed` conversation event with grades and ratings so the host agent can react.
