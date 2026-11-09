// What the claim flow calls each of the four demo claims: an owner's situation, and one line of what is in the photo
// (never the outcome: the checks say that). The same words in the picker, on the photo step and on a result's "Next
// claim". `alt` says what the photo shows, for the camera's still. `tag` is the tag in the photo, cut from the photo's
// full-size original (2:1, 800 x 400), for a refusal that turns on what the tag says.
export const SAMPLE_COPY: Record<string, { title: string; line: string; alt: string; tag?: string }> = {
  genuine: { title: "A genuine claim", line: "The pillow cut in half, its tag written with this claim’s code.", alt: "A feather-print pillow cut in half, its tag reading X-VESOLJE M4T" },
  "wrong-code": {
    title: "Wrong code on the tag",
    line: "A real cut pillow, but the tag carries a code this claim was never given.",
    alt: "A floral pillow cut in half, its tag reading X-VESOLJE K7Q",
    tag: "/demo/k02-tag.jpg",
  },
  "ai-no-session": { title: "A photo from the web", line: "A picture of a cut pillow, sent from outside this claim’s camera session.", alt: "A floral pillow cut in half, a tag reading H6N beside it" },
  reposted: { title: "A photo used before", line: "The genuine claim’s photo, sent again as a new claim.", alt: "A feather-print pillow cut in half, its tag reading X-VESOLJE M4T" },
};

export const sampleTitle = (id: string, fallback = "Claim") => SAMPLE_COPY[id]?.title ?? fallback;
