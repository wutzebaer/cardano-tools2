import { TELEGRAM_URL } from "@cardano/pool";
import { PageHeader } from "@components/ui";
import Link from "next/link";
import { CONTACT_EMAIL, LegalHeading, LegalText } from "../Legal";

export const metadata = { title: "Impressum · Cardano Tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Impressum" />
      <LegalText lang="de">
        <p>Angaben gemäß § 5 DDG</p>
        <p>
          Peter Großmann
          <br />
          <br />
        </p>

        <LegalHeading>Kontakt</LegalHeading>
        <p>
          E-Mail:{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <br />
          Telegram:{" "}
          <a className="link" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            {TELEGRAM_URL.replace("https://", "")}
          </a>
        </p>

        <LegalHeading>Haftung für Inhalte</LegalHeading>
        <p>
          Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Als Diensteanbieter bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden diese Inhalte umgehend entfernt.
        </p>
        <p>
          Token, Bilder und Metadaten, die diese Seite anzeigt, stammen von der öffentlichen Cardano-Blockchain und aus dem IPFS-Netzwerk. Sie werden von Dritten erstellt und lassen sich dort nicht löschen; rechtswidrige Inhalte werden nach einem Hinweis auf dieser Seite ausgeblendet.
        </p>

        <LegalHeading>Haftung für Links</LegalHeading>
        <p>
          Dieses Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte ich keinen Einfluss habe. Deshalb kann für diese fremden Inhalte auch keine Gewähr übernommen werden. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden derartige Links umgehend entfernt.
        </p>

        <LegalHeading>Urheberrecht</LegalHeading>
        <p>
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitte ich um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden derartige Inhalte umgehend entfernt.
        </p>

        <LegalHeading>Datenschutz</LegalHeading>
        <p>
          Welche Daten diese Seite verarbeitet, steht in der{" "}
          <Link className="link" href="/legal/privacy">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <p>Der Nutzung der im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten durch Dritte zur Übersendung von nicht ausdrücklich angeforderter Werbung und Informationsmaterialien wird hiermit ausdrücklich widersprochen.</p>
        <p>Impressum auf Grundlage des Impressum Generators der Kanzlei Hasselbach, Frankfurt</p>
      </LegalText>
    </>
  );
}
