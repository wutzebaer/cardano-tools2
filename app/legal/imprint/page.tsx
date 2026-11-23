import { TELEGRAM_URL } from "@cardano/pool";
import { PageHeader } from "@components/ui";
import Link from "next/link";
import { CONTACT_EMAIL, LegalHeading, LegalText } from "../Legal";

export const metadata = { title: "Imprint · Cardano Tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Imprint" />
      <LegalText lang="en">
        <p>Information pursuant to § 5 DDG (German Digital Services Act)</p>
        <p>
          Peter Großmann
          <br />
          <br />
          <br />
          Germany
        </p>

        <LegalHeading>Contact</LegalHeading>
        <p>
          Email:{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <br />
          Telegram:{" "}
          <a className="link" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            {TELEGRAM_URL.replace("https://", "")}
          </a>
        </p>

        <LegalHeading>Liability for content</LegalHeading>
        <p>
          The content of these pages was created with great care. However, no guarantee can be given that it is correct, complete and up to date. As a service provider I am responsible for my own content on these pages under the general laws (§ 7 (1) DDG). Under §§ 8 to 10 DDG I am not obliged, however, to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity. Obligations to remove or block the use of information under the general laws remain unaffected. Liability in this respect is only possible from the moment a specific infringement becomes known. Once such an infringement becomes known, the content concerned is removed immediately.
        </p>
        <p>
          Tokens, images and metadata shown on this site come from the public Cardano blockchain and from the IPFS network. They are created by third parties and cannot be deleted there; unlawful content is hidden on this site after it has been reported.
        </p>

        <LegalHeading>Liability for links</LegalHeading>
        <p>
          This site contains links to external websites of third parties whose content I cannot influence. Therefore no guarantee can be given for that content. The provider or operator of a linked site is always responsible for its content. The linked sites were checked for possible legal violations when the links were set, and no unlawful content was apparent at that time. Permanent monitoring of the linked sites is not reasonable without specific indications of an infringement. Once an infringement becomes known, such links are removed immediately.
        </p>

        <LegalHeading>Copyright</LegalHeading>
        <p>
          The content and works created by the operator on these pages are subject to German copyright law. Where content on this site was not created by the operator, the copyrights of third parties are respected. Should you nevertheless become aware of a copyright infringement, please let me know. Once an infringement becomes known, such content is removed immediately.
        </p>

        <LegalHeading>Privacy</LegalHeading>
        <p>
          Which data this site processes is described in the{" "}
          <Link className="link" href="/legal/privacy">
            privacy policy
          </Link>
          .
        </p>
        <p>The use of the contact details published here by third parties to send advertising and information material that was not expressly requested is hereby expressly rejected.</p>
        <p>Imprint based on the imprint generator of the law firm Hasselbach, Frankfurt</p>
      </LegalText>
    </>
  );
}
