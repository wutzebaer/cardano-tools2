import { TELEGRAM_URL } from "@cardano/pool";
import { PageHeader } from "@components/ui";
import Link from "next/link";
import { CONTACT_EMAIL, LegalHeading, LegalText } from "../Legal";

export const metadata = { title: "Terms of Service · Cardano Tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Terms of Service" />
      <LegalText lang="en">
        <p>
          These terms apply to the use of cardano-tools.io (the &quot;site&quot;), operated by the person named in the{" "}
          <Link className="link" href="/legal/imprint">
            imprint
          </Link>{" "}
          (the &quot;operator&quot;). By using the site you agree to them. If you do not agree, please do not use the site.
        </p>

        <LegalHeading>What the site does</LegalHeading>
        <p>
          The site is a free tool for the Cardano blockchain. It shows public chain data and helps you build transactions, for example to mint or burn tokens, set royalties, register a token, send rewards to stakers or delegate your stake. There are no user accounts. The site never holds your funds or the keys of your wallet: every transaction is shown to you in your own wallet and is only sent after you have signed it there.
        </p>

        <LegalHeading>Your responsibility</LegalHeading>
        <p>
          Transactions on the blockchain are final. Nobody, including the operator, can reverse, change or delete them, and ADA or tokens sent to a wrong address or burned by mistake are lost. Check every transaction in your wallet before you sign it. Network fees and deposits are charged by the Cardano network, not by the site.
        </p>
        <p>
          Minting policies created on the site are signed by your wallet, so whoever controls the wallet controls the policy. If you import a policy with its own signing key, that key is kept only in your browser. If you clear the browser&apos;s storage or lose the device, it is gone and the operator cannot restore it. Keep your own copy of every key you import.
        </p>
        <p>
          You are solely responsible for everything you mint, upload or publish through the site, and you confirm that you hold the necessary rights to it. Files you upload are published on the public IPFS network and metadata is written to the public blockchain; both are visible to everyone and cannot be reliably removed.
        </p>

        <LegalHeading>Prohibited use</LegalHeading>
        <p>
          You may not use the site for anything unlawful, in particular to publish content that infringes the rights of others, that is illegal or that deceives others (for example counterfeit tokens or impersonation), to distribute malicious code, or to interfere with the operation or security of the site. The operator may hide content on the site and block access in case of misuse.
        </p>

        <LegalHeading>Staking</LegalHeading>
        <p>
          Delegating to the [TOOLS] stake pool happens on the Cardano network and under its rules. Your ADA stays in your wallet and you can change your delegation at any time. Rewards depend on the network and on the blocks the pool produces; they are not guaranteed. Nothing on the site is financial, investment or tax advice.
        </p>

        <LegalHeading>Data shown on the site</LegalHeading>
        <p>
          Tokens, images, prices and statements are taken from the blockchain and from third-party sources and are shown without review. They may be incomplete, delayed or wrong. A wallet statement created on the site is an aid and does not replace your own records or professional tax advice. Links to other websites are provided for convenience; the operator is not responsible for their content.
        </p>

        <LegalHeading>Availability</LegalHeading>
        <p>The site is provided free of charge and as it is. There is no entitlement to its availability; it may be changed, interrupted or discontinued at any time.</p>

        <LegalHeading>Liability</LegalHeading>
        <p>
          The operator is liable without limitation for intent and gross negligence and for injury to life, body or health. Because the site is provided free of charge, any further liability is excluded to the extent permitted by law. This applies in particular to losses caused by transactions you signed, lost keys, wrong or missing data, faults of your wallet, of the blockchain or of third-party services, and to interruptions of the site.
        </p>

        <LegalHeading>Source code</LegalHeading>
        <p>
          The source code of the site is published on{" "}
          <a className="link" href="https://github.com/wutzebaer/cardano-tools2" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          , so you can check what it does.
        </p>

        <LegalHeading>Final provisions</LegalHeading>
        <p>
          German law applies. If you are a consumer, mandatory consumer protection rules of the country you live in remain unaffected. Should a provision of these terms be invalid, the remaining provisions stay in force. The operator may change these terms; the version published here at the time of use applies.
        </p>

        <LegalHeading>Contact</LegalHeading>
        <p>
          Questions about these terms:{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          or the{" "}
          <a className="link" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            Telegram channel
          </a>
          .
        </p>

        <p>Last updated on November 23, 2026</p>
      </LegalText>
    </>
  );
}
