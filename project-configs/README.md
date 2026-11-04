# Project configs

Each customer/project guideline document is converted into a folder `project-configs/<slug>/`. Adding a project = dropping a new folder; nothing is hard-coded in app logic. The seed loads every folder as an additional TrainingProgram.

```
<slug>/
  config.json          structured config (validated by zod in app/src/lib/project-config.ts)
  guidelines.md        cleaned guideline text; images referenced as images/imageN.png
  images/*.png         reference images from the doc
  images/captions.json {"imageN.png": "caption"}
  source/              original document + raw extraction
```

## config.json fields

- `slug` (string): folder name, unique id.
- `name`, `description` (string): display name and summary.
- `source` `{file, extracted}`: paths (relative to the folder) of the original doc and its text extract.
- `annotationTypes` (string[]): e.g. `CUBOID`, `TRACKING` (also `SEGMENTATION`, etc.).
- `enabledTracks` (string[]): learn/practice tracks enabled: `cuboid`, `tracking`, `segmentation`, `instance`, `scene_classification`, `sensor_fusion`.
- `navigationProfile` (`orbit` | `fly`): default viewer navigation.
- `coordinate`: `upAxis` (`Z`|`Y`), `yawConvention` (e.g. `CCW_ABOUT_UP`), `boxDefinition` (`CENTER_DIMS_YAW`), plus project text hints `lengthAxis`, `heightAxis`.
- `passingScore` (number, percent): final assessment pass mark.
- `roi` (array): regions of interest by distance. Each `{key, rangeM:[min,max|null], requirement}`; `null` max = unbounded.
- `labelSchema`:
  - `groups`: `[{key, name, classes:[classKey]}]`.
  - `classes`: `[{key, name, group, classId, definition, cuboidRules[], images[{file,caption}], attributes[attributeKey]}]`. `classId` is a **project-local integer** (1..N in document order); it is not shared across projects and is what appears as the "Class ID" field on each object.
- `attributes`: `[{key, name, type, required, appliesTo, options[{key,name,description?}]}]`. `type` is `single_select`. `appliesTo` is `"all"` or an array of class keys. A class lists the attribute keys that apply to it in its `attributes`.
- `trackId`: `{required, type, rules[]}` persistent object identity rules.
- `generalRules` (string[]): general annotation rules, one per bullet.
- `requiredFieldsPerObject` (string[]): fields every cuboid must have (`trackId`, `classId`, attribute keys).
- `preLabels.rules`, `imageAlignment.rules` (string[]): workflow rules for model pre-labels and 2D image alignment.
- `referenceVideos`: `[{title, url}]`.
- `commonMistakes` (string[]): shown in project modules.
- `quizSeeds`: `[{kind, prompt, options[], correctAnswer, explanation, imageFile?}]`. `kind` is `MULTIPLE_CHOICE`, `TRUE_FALSE`, `CHOOSE_DECISION` or `IDENTIFY_OBJECT`. `correctAnswer` is an option index (for TRUE_FALSE options are `["True","False"]`, so index 0 = True). `imageFile` is relative to the folder.

All image paths are relative to the project folder.
