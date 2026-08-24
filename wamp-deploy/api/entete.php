<?php
/**
 * API Configuration de l'En-tête PDF (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("SELECT * FROM entete_config ORDER BY id ASC LIMIT 1");
        $res = $stmt->fetch();
        if (!$res) {
            $res = [
                'nomEtablissement' => 'HOPITALY LOTERANA TOLIARY TANAMBAO',
                'sousTitre' => 'Département de la Santé / SALFA Madagascar',
                'adresse' => 'Tanambao, B.P. 112',
                'ville' => 'Toliara (601), Madagascar',
                'telephone' => '+261 34 00 000 00 / +261 20 94 410 00',
                'email' => 'hopitaly.toliara@salfa.mg',
                'nif' => 'NIF: 3000123456',
                'stat' => 'STAT: 85110 21 1998 0 10123',
                'logoBase64' => null,
                'couleurPrincipale' => '#1e3a8a',
                'couleurSecondaire' => '#0d9488',
                'styleAlignement' => 'center',
                'piedDePage' => 'Document généré automatiquement par le logiciel Suivi Assurance SALFA.'
            ];
        } else {
            $res = [
                'nomEtablissement' => $res['nom_etablissement'],
                'sousTitre' => $res['sous_titre'],
                'adresse' => $res['adresse'],
                'ville' => $res['ville'],
                'telephone' => $res['telephone'],
                'email' => $res['email'],
                'nif' => $res['nif'],
                'stat' => $res['stat'],
                'logoBase64' => $res['logo_base64'],
                'couleurPrincipale' => $res['couleur_principale'],
                'couleurSecondaire' => $res['couleur_secondaire'],
                'styleAlignement' => $res['style_alignement'],
                'piedDePage' => $res['pied_de_page']
            ];
        }
        sendJson($res);
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        $stmt = $pdo->prepare("INSERT INTO entete_config (id, nom_etablissement, sous_titre, adresse, ville, telephone, email, nif, stat, logo_base64, couleur_principale, couleur_secondaire, style_alignement, pied_de_page)
            VALUES (1, :nomEtablissement, :sousTitre, :adresse, :ville, :telephone, :email, :nif, :stat, :logoBase64, :couleurPrincipale, :couleurSecondaire, :styleAlignement, :piedDePage)
            ON DUPLICATE KEY UPDATE 
            nom_etablissement = VALUES(nom_etablissement), sous_titre = VALUES(sous_titre), adresse = VALUES(adresse), 
            ville = VALUES(ville), telephone = VALUES(telephone), email = VALUES(email), nif = VALUES(nif), 
            stat = VALUES(stat), logo_base64 = VALUES(logo_base64), couleur_principale = VALUES(couleur_principale), 
            couleur_secondaire = VALUES(couleur_secondaire), style_alignement = VALUES(style_alignement), pied_de_page = VALUES(pied_de_page)");

        $stmt->execute([
            ':nomEtablissement' => $data['nomEtablissement'] ?? 'HOPITALY LOTERANA TOLIARY TANAMBAO',
            ':sousTitre' => $data['sousTitre'] ?? 'Département de la Santé / SALFA Madagascar',
            ':adresse' => $data['adresse'] ?? 'Tanambao, B.P. 112',
            ':ville' => $data['ville'] ?? 'Toliara (601), Madagascar',
            ':telephone' => $data['telephone'] ?? '',
            ':email' => $data['email'] ?? '',
            ':nif' => $data['nif'] ?? '',
            ':stat' => $data['stat'] ?? '',
            ':logoBase64' => $data['logoBase64'] ?? null,
            ':couleurPrincipale' => $data['couleurPrincipale'] ?? '#1e3a8a',
            ':couleurSecondaire' => $data['couleurSecondaire'] ?? '#0d9488',
            ':styleAlignement' => $data['styleAlignement'] ?? 'center',
            ':piedDePage' => $data['piedDePage'] ?? ''
        ]);

        sendJson(['message' => 'Configuration de l-en-tête enregistrée']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
