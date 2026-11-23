import { PageHeader } from "@components/ui";
import Link from "next/link";
import { CONTACT_EMAIL, LegalHeading, LegalText } from "../Legal";

export const metadata = { title: "Privacy · Cardano Tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Privacy Policy" />
      <LegalText lang="en">
        <p>Cardano Tools works without user accounts, without cookies and without tracking. This page explains which data is processed nevertheless.</p>

        <LegalHeading>Controller</LegalHeading>
        <p>
          Peter Großmann, postal address in the{" "}
          <Link className="link" href="/legal/imprint">
            imprint
          </Link>
          , email{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <LegalHeading>Visiting the site</LegalHeading>
        <p>
          The site runs on a server of Hetzner Online GmbH in Germany. For every request the server logs the IP address, the time, the requested address and the identification of the browser. The logs serve the secure operation of the site and the search for errors (Art. 6 (1) (f) GDPR). They are not analysed, not combined with other data and are overwritten automatically once they reach a fixed size.
        </p>

        <LegalHeading>Wallet and blockchain data</LegalHeading>
        <p>
          If you connect a wallet or enter an address, that address is sent to the server of the site so that it can look up the related tokens, transactions and rewards on the public Cardano blockchain. These lookups are not stored permanently and are not assigned to a user. The private keys of your wallet never leave the wallet; every transaction is confirmed there one by one.
        </p>
        <p>
          Transactions created through this site are, like all transactions, public and permanent on the blockchain. They can neither be changed nor deleted. To submit it, the signed transaction is handed to the public service Koios (api.koios.rest); it contains nothing that does not appear on the blockchain anyway.
        </p>

        <LegalHeading>Uploaded files</LegalHeading>
        <p>
          Images and other files you upload when minting are published on the IPFS network. They are publicly available from then on and can be copied by other participants of the network; they cannot be reliably deleted. Therefore do not upload files that contain personal data.
        </p>

        <LegalHeading>Browser storage</LegalHeading>
        <p>
          The site keeps some information in the local storage of your browser: the wallet you selected last, the minting policies you created or imported (for imported ones including the signing key) and the addresses you last used for a wallet statement. This information stays on your device, is not transferred to the server and can be deleted in the settings of your browser. The site does not set cookies.
        </p>

        <LegalHeading>Third-party services</LegalHeading>
        <p>
          The server of the site fetches prices from Kraken and information about token collections from Anvil. Neither your IP address nor your wallet address is passed on. Token images are delivered by the server of the site, even if they originally come from the IPFS network or from other addresses. The site does not embed fonts, scripts or statistics services of other providers. Only when you follow a link to another site does that site&apos;s privacy policy apply.
        </p>

        <LegalHeading>Contact</LegalHeading>
        <p>
          If you write by email or Telegram, your details are used only to answer your request (Art. 6 (1) (f) GDPR) and are deleted as soon as they are no longer needed. For Telegram, the terms of Telegram apply in addition.
        </p>

        <LegalHeading>Your rights</LegalHeading>
        <p>
          You have the right of access, rectification, erasure, restriction of processing and data portability as well as the right to object to processing (Art. 15 to 21 GDPR). An email to the address above is sufficient. Data on the blockchain and on the IPFS network is beyond my control and cannot be deleted by me. You may also lodge a complaint with a data protection supervisory authority, for example the Hessian Commissioner for Data Protection and Freedom of Information.
        </p>

        <p>Last updated on November 23, 2026</p>
      </LegalText>
    </>
  );
}
