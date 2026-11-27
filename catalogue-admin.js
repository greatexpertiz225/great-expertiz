/* Référentiel interne GREAT EXPERTIZ : volumes indicatifs, à confirmer selon dimensions réelles. */
(function(){
const CATALOG=[
['Vaisselle, couverts et cuisine',[
 ['Couverts et ustensiles',['Fourchettes (lot de 12)|0.002','Couteaux (lot de 12)|0.003','Cuillères (lot de 12)|0.002','Petites cuillères (lot de 12)|0.001','Louches, spatules et pinces (lot)|0.006','Ustensiles de cuisine divers (carton)|0.04','Ménagère complète (coffret)|0.012']],
 ['Assiettes et plats',['Assiettes plates (lot de 6)|0.012|F','Assiettes creuses (lot de 6)|0.014|F','Assiettes à dessert (lot de 6)|0.008|F','Plats de service|0.012|F','Plateaux|0.02']],
 ['Bols, saladiers et tasses',['Bols (lot de 6)|0.012|F','Saladiers|0.012|F','Soupières|0.02|F','Tasses (lot de 6)|0.01|F','Mugs (lot de 6)|0.012|F']],
 ['Verres, carafes et bouteilles',['Verres à eau (lot de 6)|0.008|F','Verres à vin (lot de 6)|0.012|F','Flûtes (lot de 6)|0.012|F','Carafes et pichets|0.008|F','Bouteilles vides (caisse de 12)|0.03|F']],
 ['Marmites, casseroles et poêles',['Marmites|v|Petite=0.03;Moyenne=0.06;Grande=0.12','Casseroles (lot de 3)|0.03','Poêles (lot de 3)|0.03','Couvercles (lot)|0.02','Cocottes et faitouts|0.05']],
 ['Accessoires de cuisine',['Passoires et râpes (lot)|0.02','Planches à découper (lot)|0.02','Boîtes alimentaires (carton)|0.05']],
 ['Services et batteries complètes',['Service complet de table (12 personnes)|0.08|F','Batterie de cuisine complète|0.12','Vaisselle en carton|v|Verre=0.06;Porcelaine=0.06;Céramique=0.06;Inox=0.05;Plastique=0.07|F']]]],
['Linge et textile',[
 ['Literie',['Draps (lot)|v|Simple=0.01;Double=0.015;Queen size=0.018;King size=0.02','Housses de matelas|v|1 place=0.02;2 places=0.03;Queen/King=0.04','Taies d’oreiller (lot de 4)|0.005','Couettes|v|Simple=0.04;Double=0.06;King=0.08','Couvertures|0.03','Plaids|0.02','Oreillers (lot de 2)|0.06','Coussins (lot de 4)|0.08','Traversins|0.04']],
 ['Linge de bain et de table',['Serviettes de toilette (lot)|0.01','Draps de bain (lot)|0.015','Gants de toilette (lot)|0.003','Nappes et chemins de table (lot)|0.01','Serviettes de table (lot de 12)|0.004']],
 ['Rideaux et stores',['Rideaux (paire)|0.03','Voilages (paire)|0.015','Stores|0.03','Tringles (lot)|0.01']],
 ['Vêtements, chaussures et sacs',['Vêtements (carton)|0.1','Chaussures (carton)|0.08','Sacs (carton)|0.12','Uniformes (carton)|0.08']],
 ['Tapis et textiles',['Tapis|v|Petit=0.1;Moyen=0.2;Grand=0.4','Moquette (rouleau)|0.3','Tissus (rouleau)|0.1','Linge professionnel (balle)|0.2']]]],
['Événementiel et réception',[
 ['Chaises',['Chaises de table|0.06','Chaises en plastique|0.06','Chaises pliantes|0.05','Chaises de cérémonie|0.12','Chaises de bureau|0.3','Chaises hautes|0.15','Housses de chaise (lot de 50)|0.1']],
 ['Tables, tréteaux et bancs',['Tables à manger|v|Carrée=0.35;Rectangulaire=0.4;Ronde=0.4','Tables carrées|0.35','Tables rondes|0.35','Tables rectangulaires|0.3','Tables pliantes|0.2','Tables d’étude|0.8','Mange-debout|0.35','Tréteaux (paire)|0.1','Plateaux de table|0.25','Bancs|0.2','Tabourets|0.08']],
 ['Bâches, tentes et chapiteaux',['Bâches|0.08','Tentes|v|3 × 3 m=0.4;3 × 6 m=0.7;6 × 12 m=2.5','Chapiteaux|v|Petit=3;Moyen=6;Grand=12|L','Tonnelles|0.25','Structures démontables|0.8']],
 ['Décoration',['Nappes événementielles (lot)|0.03','Housses de table (lot)|0.03','Arches|0.5','Fleurs artificielles (carton)|0.2|F','Décorations (carton)|0.15|F','Tapis de cérémonie (rouleau)|0.3']],
 ['Podiums, barrières et supports',['Podiums|0.8','Estrades (module)|0.4','Barrières (lot de 5)|0.3','Portants|0.15','Supports et pieds (lot)|0.1']],
 ['Sonorisation et éclairage',['Enceintes|v|Petite=0.05;Moyenne=0.15;Grande=0.4|F','Micros (valise)|0.02|F','Éclairages et projecteurs (flight case)|0.2|F','Tables de mixage|0.05|F']],
 ['Matériel par type d’événement',['Matériel de mariage (carton)|0.15|F','Matériel de conférence (caisse)|0.2|F','Matériel de concert (flight case)|0.4|F','Matériel de réception (caisse)|0.2']]]],
['Mobilier et déménagement',[
 ['Salon',['Canapés|v|1 place=1;2 places=1.5;3 places=2;Angle=3','Fauteuils|v|1 place=0.45;2 places=0.8;3 places=1.1','Poufs|0.3','Tables basses|0.4']],
 ['Chambre',['Lits (cadre)|v|1 place=0.8;2 places=1.5;Queen=1.7;King=2','Sommiers|v|1 place=0.7;2 places=1.2','Matelas|v|1 place=0.4;2 places=0.8;Queen/King=1','Têtes de lit|0.4']],
 ['Rangements',['Armoires|v|2 portes=1.5;3 portes=2.5;4 portes=3.2','Commodes|0.6','Buffets|1','Vaisseliers|1.5|F','Vitrines|1.2|F']],
 ['Bureau et séjour',['Étagères|0.5','Bureaux|1','Tables de réunion|1.5','Meubles TV|0.6','Bibliothèques|0.9']],
 ['Meubles démontés',['Meubles démontés (lot)|0.5','Portes|0.3','Panneaux (lot)|0.3','Plans de travail|0.3']],
 ['Électroménager',['Réfrigérateurs|v|Petit=0.5;Standard=0.9;Américain=1.6','Congélateurs|v|Coffre=1;Armoire=0.9','Lave-linge|0.6','Sèche-linge|0.6','Cuisinières|0.6','Gazinière 4 feux|0.45','Gazinière 5 feux|0.55','Gazinière 6 feux|0.65','Gazinière avec four 4 feux|0.6','Gazinière avec four 5 feux|0.7','Table de cuisson à gaz|0.12','Bouteille de gaz 6 kg (vide)|0.035|R','Bouteille de gaz 12,5 kg (vide)|0.055|R','Bouteille de gaz 15 kg (vide)|0.065|R','Bouteille de gaz 25 kg (vide)|0.09|R','Bouteille de gaz 28 kg (vide)|0.10|R','Bouteille de gaz 32 kg (vide)|0.12|R','Fours|0.2','Micro-ondes|0.08','Climatiseurs|v|Split intérieur=0.12;Split extérieur=0.15;Fenêtre=0.15']],
 ['Objets fragiles et décoratifs',['Miroirs|v|Petit=0.03;Moyen=0.08;Grand=0.15|F','Tableaux|v|Petit=0.02;Moyen=0.06;Grand=0.12|F','Lustres|0.15|F','Objets fragiles (carton)|0.06|F','Coffres-forts|v|Petit=0.1;Moyen=0.3;Grand=0.8|L']]]],
['Bureautique, informatique et électronique',[
 ['Ordinateurs et impression',['Ordinateurs de bureau|0.08|F','Ordinateurs portables|0.012|F','Écrans|0.06|F','Imprimantes|0.1|F','Scanners|0.05|F','Photocopieurs|v|De bureau=0.6;Grand format=1|F']],
 ['Image et son',['Téléviseurs|v|32 pouces=0.12;43 pouces=0.2;55 pouces=0.3;65 pouces et plus=0.45|F','Vidéoprojecteurs|0.03|F','Consoles|0.02|F','Équipements audio|0.08|F']],
 ['Téléphonie et réseau',['Téléphones (carton)|0.01|F','Routeurs et équipements réseau (lot)|0.02|F','Serveurs|0.15|F','Baies informatiques|0.8|F']],
 ['Mobilier de bureau',['Bureaux de direction|1.5','Fauteuils de direction|0.4','Chaises de bureau|0.3','Armoires d’archives|1','Caissons et classeurs|0.3']],
 ['Dossiers et fournitures',['Cartons de dossiers|0.04','Classeurs (carton)|0.04','Livres (carton)|0.03','Fournitures de bureau (carton)|0.05']],
 ['Énergie et accessoires',['Onduleurs|0.05|R','Batteries|0.02|R','Câbles et accessoires (carton)|0.03']]]],
['Commerce, marchandises et grossistes',[
 ['Alimentaire emballé et boissons',['Cartons de produits alimentaires emballés|0.05','Cartons de boissons|0.04','Packs d’eau (pack de 6)|0.01','Sacs de denrées (sac)|0.05']],
 ['Mode et accessoires',['Cartons de vêtements|0.1','Cartons de chaussures|0.08','Sacs et accessoires (carton)|0.1']],
 ['Beauté et parfumerie',['Cosmétiques et produits de beauté (carton)|0.04|F','Parfumerie (carton)|0.04|F R']],
 ['Maison',['Articles ménagers (carton)|0.08','Ustensiles et petits équipements (carton)|0.06']],
 ['Jouets, scolaire et papeterie',['Jouets (carton)|0.1','Fournitures scolaires (carton)|0.04','Papeterie (carton)|0.04']],
 ['Entretien et emballages commerciaux',['Produits d’entretien autorisés (carton)|0.04|R','Emballages commerciaux (balle)|0.2']],
 ['E-commerce et commandes',['Colis e-commerce|v|Petit=0.005;Moyen=0.02;Grand=0.06','Commandes clients (lot)|0.1','Lots de marchandises|0.3']],
 ['Sacs, ballots, caisses et palettes',['Sacs|0.05','Ballots|0.15','Caisses|0.12','Palettes de marchandises|v|Demi-palette=0.6;Palette standard=1.2;Palette haute=1.8']]]],
['Matériaux, bricolage et équipements professionnels',[
 ['Outils',['Caisses à outils|0.03','Outils (carton)|0.05','Établis|0.5','Échelles|v|Petite=0.1;Moyenne=0.2;Grande=0.35']],
 ['Tuyaux, câbles et profilés',['Tuyaux (lot)|0.1','Câbles (rouleau)|0.15','Gaines (rouleau)|0.1','Rouleaux divers|0.1','Profilés (lot)|0.1']],
 ['Carrelage et sanitaires',['Carrelage (carton)|0.02|L','Sanitaires|0.3|F','Lavabos|0.15|F','Robinetterie (carton)|0.03']],
 ['Menuiserie',['Portes|0.3','Fenêtres|0.2|F','Panneaux|0.2','Plaques|0.15','Menuiserie (lot)|0.3']],
 ['Matériaux de chantier',['Matériaux de chantier (palette)|1|L','Sacs de matériaux (sac)|0.04|L']],
 ['Peintures',['Peintures et produits assimilés (carton)|0.03|R']],
 ['Atelier et machines',['Équipements d’atelier|0.5','Compresseurs|v|Petit=0.1;Moyen=0.3;Grand=0.8|L','Machines|v|Petite=0.3;Moyenne=1;Grande=4|L']],
 ['Agricole et jardinage professionnel',['Matériel agricole|1','Matériel de jardinage (carton)|0.2','Équipements professionnels (caisse)|0.5']]]],
['Autres catégories',[
 ['Bagages',['Valises cabine|0.04','Valises moyennes|0.08','Grandes valises|0.12','Malles|0.2','Sacs de voyage|0.07']],
 ['Articles pour bébés',['Poussettes|0.2','Lits bébé|0.25','Chaises hautes|0.15','Parcs|0.2']],
 ['Sport',['Haltères (lot)|0.03|L','Tapis de sport|0.05','Appareils de fitness|v|Petit=0.3;Moyen=0.8;Grand=1.5|L','Équipements sportifs (carton)|0.1']],
 ['Loisirs',['Instruments de musique|v|Guitare=0.1;Clavier=0.15;Batterie=0.8;Piano droit=1.5|F','Jeux (carton)|0.05','Matériel de camping (carton)|0.1']],
 ['Jardin',['Pots et jardinières|0.1','Mobilier extérieur (lot)|0.5','Décorations de jardin (carton)|0.1']],
 ['Santé',['Mobilier médical|v|Petit=0.3;Moyen=0.8;Grand=1.5','Équipements médicaux autorisés|0.5|F']],
 ['Automobile',['Pneus|0.15','Pièces détachées (carton)|0.05','Accessoires auto (carton)|0.04']],
 ['Imprimerie, PLV et stands',['Présentoirs|0.2','Kakémonos|0.05','Enseignes|0.4|F','Stands (caisse)|1','PLV (carton)|0.1','Imprimés (carton)|0.04']],
 ['Engins roulants',['Vélo|0.6','Moto|2','Scooter|1.5','Tricycle motorisé|5','Transpalette|0.6','Chariot élévateur|6|L','Voiture|12|L']]]]];
const LOTS=[
 [['Lot vaisselle du quotidien',[['Assiettes plates (lot de 6)',1],['Assiettes creuses (lot de 6)',1],['Bols (lot de 6)',1],['Verres à eau (lot de 6)',1],['Tasses (lot de 6)',1],['Ménagère complète (coffret)',1]]],['Lot cuisine : casseroles et ustensiles',[['Casseroles (lot de 3)',1],['Poêles (lot de 3)',1],['Couvercles (lot)',1],['Ustensiles de cuisine divers (carton)',1],['Passoires et râpes (lot)',1]]],['Lot verres et carafes',[['Verres à eau (lot de 6)',1],['Verres à vin (lot de 6)',1],['Flûtes (lot de 6)',1],['Carafes et pichets',1]]]],
 [['Lot linge de lit (1 personne)',[['Draps (lot)',1,'Simple'],['Couvertures',1],['Oreillers (lot de 2)',1],['Taies d’oreiller (lot de 4)',1]]],['Lot linge de bain',[['Serviettes de toilette (lot)',1],['Draps de bain (lot)',1],['Gants de toilette (lot)',1]]],['Lot rideaux',[['Rideaux (paire)',2],['Voilages (paire)',2],['Tringles (lot)',1]]],['Lot garde-robe',[['Vêtements (carton)',2],['Chaussures (carton)',1]]]],
 [['Lot réception (20 chaises, 3 tables, nappes)',[['Chaises en plastique',20],['Tables rectangulaires',3],['Nappes événementielles (lot)',1]]],['Lot décoration',[['Nappes événementielles (lot)',1],['Housses de table (lot)',1],['Décorations (carton)',1],['Fleurs artificielles (carton)',1]]],['Lot sonorisation simple',[['Enceintes',2,'Petite'],['Micros (valise)',1],['Tables de mixage',1]]]],
 [['Lot petit mobilier',[['Tables basses',1],['Poufs',1],['Étagères',1]]],['Lot chambre simple (1 place)',[['Lits (cadre)',1,'1 place'],['Matelas',1,'1 place'],['Commodes',1]]],['Lot salon',[['Canapés',1,'3 places'],['Fauteuils',2],['Tables basses',1],['Meubles TV',1]]]],
 [['Poste de travail informatique',[['Ordinateurs portables',1],['Écrans',1],['Câbles et accessoires (carton)',1],['Chaises de bureau',1]]],['Lot fournitures et dossiers',[['Cartons de dossiers',2],['Fournitures de bureau (carton)',2],['Classeurs (carton)',1]]],['Lot téléphonie et réseau',[['Téléphones (carton)',1],['Routeurs et équipements réseau (lot)',1],['Câbles et accessoires (carton)',1]]]],
 [['Lot colis e-commerce (10 colis moyens)',[['Colis e-commerce',10,'Moyen']]],['Lot textile : vêtements, chaussures, sacs',[['Cartons de vêtements',2],['Cartons de chaussures',1],['Sacs et accessoires (carton)',1]]],['Lot cosmétiques et beauté',[['Cosmétiques et produits de beauté (carton)',2]]]],
 [['Lot outillage',[['Caisses à outils',2],['Outils (carton)',1]]],['Lot plomberie et robinetterie',[['Robinetterie (carton)',2],['Tuyaux (lot)',1]]],['Lot peinture',[['Peintures et produits assimilés (carton)',2]]]],
 [['Lot bagages (3 valises moyennes)',[['Valises moyennes',3]]],['Lot bébé',[['Poussettes',1],['Lits bébé',1],['Chaises hautes',1]]],['Lot sport et loisirs',[['Équipements sportifs (carton)',2],['Jeux (carton)',1],['Tapis de sport',1]]],['Lot jardin',[['Pots et jardinières',2],['Décorations de jardin (carton)',1]]]]];
function parseGEItem(raw){var p=raw.split('|'),variants=[];if(p[1]==='v'){variants=p[2].split(';').map(function(x){var q=x.split('=');return{label:q[0],cm3:Math.round(parseFloat(q[1])*1000000)}})}else variants=[{label:'',cm3:Math.round(parseFloat(p[1])*1000000)}];return{name:p[0],variants:variants,flags:p[3]||p[2]||''}}
var items=[];CATALOG.forEach(function(f){f[1].forEach(function(g){g[1].forEach(function(raw){var it=parseGEItem(raw);it.family=f[0];it.group=g[0];items.push(it)})})});
function findItem(n){return items.find(function(x){return x.name===n})}
LOTS.forEach(function(family,index){family.forEach(function(lot){var cm3=0,content=[];lot[1].forEach(function(row){var it=findItem(row[0]);if(!it)return;var v=row[2]?it.variants.find(function(x){return x.label===row[2]}):it.variants[0];if(v){cm3+=v.cm3*row[1];content.push(row[1]+' × '+it.name+(row[2]?' ('+row[2]+')':''))}});items.push({name:lot[0],family:CATALOG[index][0],group:'Lots prédéfinis',variants:[{label:'Lot complet',cm3:cm3}],preset:content.join(', ')})})});
window.GE_ADMIN_CATALOG=items;
})();
