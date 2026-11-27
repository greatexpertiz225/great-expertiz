# GREAT EXPERTIZ — mise en place du projet

## État du dépôt
- Site vitrine : `index.html`
- Formulaire client : `commande.html`
- Administration : `admin.html`
- Backend Google Apps Script de test : `Code.gs`
- Configuration du serveur : `config.js`
- Photographies : `images/`

Le formulaire client suit le parcours simplifié convenu : pas de code OTP, pas de catalogue d’articles, pas de choix de véhicule ni de prix calculé par le client. Le client indique son trajet (avec plusieurs lieux d’enlèvement et de livraison possibles), son type de transport, ses coordonnées, une description libre et éventuellement son poids total. GREAT EXPERTIZ étudie ensuite la demande et prépare le devis depuis l’administration.

Le module **Cotations & devis** permet à l'équipe autorisée de calculer ou d'enregistrer une cotation, de compléter manuellement les postes « sur devis » (kilométrage hors Grand Abidjan, volumes supérieurs à 10 CBM, emballage/protection), de suivre le statut du devis et de préparer un message WhatsApp. Le serveur refuse le statut « envoyée » tant que la cotation est incomplète.

## Configuration TEST indispensable

1. Dans Google Drive, créer une **copie de test** du classeur « Commandes GREAT EXPERTIZ ». Ne pas utiliser le classeur de production.
2. Ouvrir la copie, copier l’identifiant situé entre `/d/` et `/edit` dans son URL.
3. Dans le projet Apps Script associé à cette copie, remplacer le contenu de `Code.gs` par le fichier de ce dépôt.
4. Dans le fichier Apps Script, renseigner la variable `SHEET_ID` avec l’identifiant de la copie de test uniquement.
5. Enregistrer, sélectionner `setupTest` dans la liste des fonctions, puis cliquer sur **Exécuter** et autoriser les accès Google demandés.
6. Déployer comme **Application Web** : exécuter en tant que propriétaire du script et autoriser l'accès selon le cadre de test choisi. Copier l'URL de déploiement qui se termine par `/exec`.
7. Renseigner cette URL dans `config.js` sous la forme `window.GE_SCRIPT_URL = 'URL_DU_DEPLOIEMENT_TEST';`.
8. Publier les changements du dépôt puis tester une demande avec des données fictives.

## Garde-fous
- Garder `MODE_TEST = true`.
- Ne jamais mettre l'identifiant du classeur de production dans ce dépôt.
- Ne pas activer les anciens réglages OTP pour le parcours client actuel.
- Ne pas considérer une demande comme enregistrée tant que le serveur n'a pas confirmé la relecture de la ligne dans Google Sheets.
- Le formulaire et le backend ne sont pas déclarés opérationnels avant un test réel sur la copie de test.

## Vérifications
Les scripts JavaScript des pages et le fichier Apps Script ont été contrôlés syntaxiquement. Des contrôles statiques vérifient notamment les champs de formulaire, les arrêts intermédiaires, les actions de cotation et les garde-fous du mode test. Des scénarios isolés de calcul tarifaire ont également été exécutés.

Ces contrôles ne remplacent pas les essais réels dans un navigateur Android, le déploiement Apps Script, les autorisations Google, ni les tests de lecture/écriture dans la copie de test. Tant que la copie de test n'est pas reliée et testée, le site ne doit pas être considéré comme opérationnel.
