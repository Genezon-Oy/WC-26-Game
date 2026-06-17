import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Trophy, Info, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saannot")({
  component: SaannotPage,
});

function SaannotPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="text-primary w-8 h-8" /> Pelin Säännöt
        </h1>
        <p className="text-muted-foreground mt-2">
          Lue nämä huolella, jotta tiedät miten pisteitä kertyy ja miten uusi Money Making Matrix
          toimii!
        </p>
      </div>

      <div className="space-y-6">
        <section className="bg-card/60 border border-border/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Trophy className="text-yellow-500 w-5 h-5" /> 1. Perusveikkaus (Safe Score)
          </h2>
          <ul className="space-y-3 text-sm text-foreground/90 list-disc list-inside">
            <li>
              Jokaiseen otteluun voi tehdä yhden valinnan: 1 (Kotivoitto),
              X (Tasapeli) tai 2 (Vierasvoitto).
            </li>
            <li>
              Voit muuttaa valintaasi niin monta kertaa kuin haluat, aina ottelun alkupotkuun
              saakka. Voit rauhassa klikkailla veikkauksia suuntaan ja toiseen!
            </li>
            <li>
              Jos veikkaat oikein, saat pisteitä ottelun kertoimen verran (esim. jos kerroin on
              2.50, saat 2.50 pistettä).
            </li>
            <li>Pisteet annetaan varsinaisen peliajan tuloksen perusteella.</li>
          </ul>
        </section>

        <section className="bg-card/60 border border-border/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Info className="text-emerald-400 w-5 h-5" /> 2. Money Making Matrix (Matrix-tuotto)
          </h2>
          <p className="text-sm text-foreground/90 mb-3">
            Peruspisteiden lisäksi jokainen veikkaus osallistuu automaattisesti{" "}
            <strong>Money Making Matrixiin</strong>. Tämä on pelin "korkean riskin, korkean tuoton"
            ominaisuus:
          </p>
          <ul className="space-y-3 text-sm text-foreground/90 list-disc list-inside">
            <li>
              <strong>Kun veikkaat oikein:</strong> Saat Matrixiin pisteitä kertoimen verran. Tästä
              summasta <strong>50%</strong> siirtyy automaattisesti ylimääräisenä plussana suoraan
              kokonaispisteisiisi (Matrix-tuotto).
            </li>
            <li>
              <strong>Kun veikkaat väärin:</strong> Saat Matrixiin -1.0 pisteen rangaistuksen. Koska
              Matrix-tuotto on aina 50%, menetät välittömästi <strong>-0.50 pistettä</strong>{" "}
              kokonaispisteistäsi (Matrix-tappio).
            </li>
            <li className="mt-2 text-muted-foreground italic">
              Matrix-tuotto päivittyy reaaliajassa. Mitä enemmän otat riskejä (korkeat kertoimet) ja
              osut oikeaan, sitä hurjemmin Matrix nostaa kokonaispisteitäsi! Mutta jatkuvat hudit
              syövät peruspisteitäsi hitaasti mutta varmasti.
            </li>
          </ul>
        </section>

        <section className="bg-card/60 border border-border/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-500 w-5 h-5" /> 3. Futures (Turnausvedot)
          </h2>
          <ul className="space-y-3 text-sm text-foreground/90 list-disc list-inside">
            <li>
              Ennen turnauksen alkua voit veikata myös erikoiskohteita (esim. Turnauksen voittaja,
              Kultaisen kengän voittaja).
            </li>
            <li>Nämä kohteet ratkeavat vasta koko turnauksen päätyttyä.</li>
            <li>
              Futures-pisteet antavat massiivisia kertapotteja aivan pelin lopussa, ja ne voivat
              kääntää koko sarjataulukon ylösalaisin viimeisenä päivänä. Älä siis nuolaise ennen
              kuin tipahtaa!
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
