# FAST Flow — Hub de Diagnostic & Interventions

FAST Flow est un tableau de bord web professionnel conçu sur mesure pour **FAST Tech Services** (maintenance, dépannage et installation d'équipements de garages automobiles et ateliers industriels). 

Il permet aux clients d'effectuer un pré-diagnostic rapide en cas de panne et aux techniciens de suivre et gérer l'état des tickets d'interventions en temps réel.

## Fonctionnalités principales

1. **Assistant FAST Remote (Télé-Diagnostic)** :
   - Un arbre de décision interactif guidant l'utilisateur à travers une série de questions ciblées selon l'équipement défaillant (*Pont élévateur*, *Cabine de peinture*, *Compresseur*, *Station de lavage*).
   - Fournit un pré-diagnostic technique immédiat (ex: manque d'huile hydraulique, défaut de pressostat, colmatage des filtres) et une action recommandée.
   - Permet de générer instantanément un ticket d'intervention à partir du résultat du diagnostic.

2. **Gestionnaire de Tickets d'Intervention** :
   - Suivi en temps réel des demandes avec différents niveaux de gravité (Basse, Moyenne, Critique avec indicateurs visuels pulsés).
   - Modification rapide du statut des interventions (*Nouveau*, *En Diag*, *Planifié*, *Résolu*) directement depuis l'interface.
   - Persistance locale des données via `localStorage`.

3. **Minuteur de Procédure** :
   - Utilisé par les techniciens pour minuter les cycles de test et procédures d'entretien (ex: contrôle de sécurité des ponts, cycles de séchage cabine).
   - Indicateur visuel circulaire réactif et alarme sonore synthétisée via la **Web Audio API**.

4. **Indicateurs d'Activité & Générateur d'Ambiance** :
   - Graphique SVG d'historique dynamique affichant le volume d'interventions résolues au cours des 7 derniers jours.
   - Générateur de sons d'ambiance d'atelier (bruit rose de calme et ondes de concentration) pour accompagner le travail administratif ou technique.

## Déploiement

- **Langages** : HTML5, CSS3 (variables CSS, glassmorphisme), JavaScript ES6.
- **Synthèse sonore** : Web Audio API (génération de signaux en temps réel sans fichiers audio externes).
- **Graphiques** : Dessin vectoriel dynamique (SVG).
- **Sans base de données externe** : Stockage local instantané et sécurisé.
