# Zotero Library Data Quality Issues

This document catalogs data quality issues found in a real Zotero RDF library export (21,797 authors) to inform a future Search & Replace plugin for cleaning up library data.

## Issue Categories

### 1. Commas in Wrong Position (Parsing Errors)

**Problem:** Author names have commas in the wrong field, indicating Zotero/bibtex parsing errors.

| Given Name Field | Surname Field | Issue |
|-----------------|---------------|-------|
| `Gareth, J.H. McDowell` | `Evans` | First name and comma in given field |
| `Pezzulo ,Giovanni` | `None` | Space before comma |
| `G.W., Jr.` | `Zopf` | Suffix in given field |
| `Albert R., III` | `Powers` | Roman numeral suffix in given field |
| `Jerome Seymour, Olver, Rose R` | `Bruner` | Multiple commas - multi-author parsing failure |
| `Patricia Marks, Hornsby, Joan Rigny` | `Greenfield` | Multiple authors in one field |
| `Bruno, Woolgar, Steve` | `Latour` | Corporate/group author misparsed |
| `F.J. Von Zuben, And H. Knidel` | `L.N. De Castro` | Complete parsing failure |
| `Bebbington P,` | `McManus S` | Truncated name |

**Search Patterns:**
```
# Given name contains comma
(?<=givenName>)[^<]*,[^<]*(?=</)

# Space before comma
 ,\s*
```

---

### 2. Inverted Name Order (First Last in Surname Field)

**Problem:** Full names appear in surname field when given name is empty.

| Surname Field | Issue |
|--------------|-------|
| `Miłkowski, Marcin` | Full name "Miłkowski, Marcin" in surname |
| `Zuse, Konrad` | Full name in surname |
| `Franklin, L.R.` | Full name in surname |

**Search Pattern:**
```
# Surname contains comma (likely full name)
[^<]*, [^<]+
```

---

### 3. Corporate/Institutional Authors in Person Fields

**Problem:** Organizational names appear where person names expected.

| Surname Field | Given Name Field | Issue |
|--------------|-----------------|-------|
| `Global Burden of Disease Study 2013 Collaborators` | empty | Group author |
| `American Psychiatric Association` | empty | Organization |
| `International Wittgenstein symposium` | empty | Event name |
| `Journal of Philosophy Inc.` | empty | Publisher |
| `MIND Group` | empty | Research group |
| `Copernicus Center for Interdisciplinary Studies` | empty | Institution |
| `PDP Research Group` | empty | Group author |
| `The Lancet Neurology` | empty | Journal name |

**Search Patterns:**
```
# Organizations that should be creators, not persons
(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings|In Proceedings|Conference|Symposium|Workshop)
```

---

### 4. Parentheses and Nicknames in Name Fields

**Problem:** Informal names, nicknames, or metadata in name fields.

| Given Name | Surname | Issue |
|-----------|---------|-------|
| `Nicoletta Calzolari (Conference Chair)` | | Role in parentheses |
| `Rui (Juliet)` | `Zhu` | Nickname |
| `Kees (C.N.J.) de Vey` | `Mestdagh` | Initials in parens |

**Search Patterns:**
```
# Parentheses in name fields
\([^)]+\)
```

---

### 5. Roman Numerals and Suffixes in Wrong Field

**Problem:** Jr, Sr, III, IV, etc. suffixes appear in given name field.

| Given Name | Surname | Issue |
|-----------|---------|-------|
| `Albert R., III` | `Powers` | III in given field |
| `G.W., Jr.` | `Zopf` | Jr in given field |
| `Raymond W. Jr.` | `Gibbs` | Jr in given field |

**Search Pattern:**
```
# Jr/Sr/Roman numerals in given name
(Jr|Sr|III|IV|II)\b
```

---

### 6. Single-Letter Given Names (Likely Truncated)

**Problem:** Given names that are single letters, likely middle initials not properly captured.

| Given | Surname | Count |
|-------|---------|-------|
| `J.` | various | 97 |
| `M.` | various | 83 |
| `R.` | various | 58 |
| `F` | `Edward H.` | Single letter surname? |
| `U` | `Kam Hou` | Inverted? |
| `A` | `Lavender` | Truncated? |

**Search Pattern:**
```
# Single letter given name (may need manual review)
^?[A-Z]\.?$
```

---

### 7. Hyphenated Surname Issues

**Problem:** Hyphenated surnames from different cultural traditions.

| Surname | Origin |
|---------|--------|
| `Chicas-Mosier` | Spanish-American |
| `Talmont-Kamiński` | Polish |
| `Lewandowska-Tomaszczyk` | Polish |
| `Dehaene-Lambertz` | Dutch-French |
| `MacDougall-Shackleton` | Scottish |
| `Wynne-Edwards` | Welsh |
| `McMillan-Major` | Scottish-Irish |

**Note:** These are correct - the plugin should preserve hyphenated surnames.

---

### 8. Case Sensitivity Issues in Surnames

**Problem:** Surnames with lowercase prefixes that need special handling.

| Surname | Origin | Correct Citation |
|---------|--------|------------------|
| `van Gelder` | Dutch | van Gelder (not Van Gelder) |
| `van der Meer` | Dutch | van der Meer |
| `de Jong` | Dutch | de Jong (not De Jong) |
| `de Haan` | Dutch | de Haan |
| `von Cramon` | German | von Cramon (not Von Cramon) |
| `Von Neumann` | German | von Neumann |
| `Ramón y Cajal` | Spanish | Ramón y Cajal (y stays lowercase) |

**Search Patterns:**
```
# Dutch/German prefixes (should stay lowercase)
(?i)\bvan\s+(der|de|den|het)\b
(?i)\bde\s+\w+
(?i)\bvon\s+

# Spanish conjunction (should stay lowercase)
 y\s+
```

---

### 9. Mc/Mac Prefix Variations

**Problem:** Scottish/Irish prefixes with varying capitalization.

| Surname | Issue |
|---------|-------|
| `McCulloch` | Standard |
| `MCCULLOCH` | All caps - normalize to McCulloch |
| `MacDonald` | Standard |
| `MACDONALD` | All caps - normalize to MacDonald |
| `Macdonald` | Anglicized (preserving lowercase d) |
| `MACHAMER` | NOT Mac surname - German "Machamer" (philosopher Peter Machamer) |

**Search Pattern:**
```
# Mc/Mac surnames needing normalization
M{1,2}C[A-Z]
M{1,2}AC[A-Z]
```

---

### 10. Empty Given Names (Corporate Authors)

**Problem:** Authors with no given name field populated.

| Surname | Suggested Action |
|---------|-----------------|
| `American Psychiatric Association` | Convert to corporate author |
| `Journal of Philosophy Inc.` | Convert to publisher |
| `Copernicus Center for Interdisciplinary Studies` | Convert to institutional author |
| `International Wittgenstein Symposium` | Convert to event name |
| `MIND Group` | Convert to group author |

---

## Recommended Search & Replace Patterns

### Priority 1: Fix Immediately

```regex
# Fix space before comma
Search:  ,
Replace: ,

# Move Jr/Sr/III suffixes from given to surname
Search:  (.+), (Jr|Sr|III|IV)\s*$
Replace: $2, $1

# Fix inverted full names in surname
Search:  ([A-Z][a-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+), ([A-Z])
Replace: $2, $1
```

### Priority 2: Manual Review Needed

```regex
# Find multi-author parsing failures
Search:  .+, .+, .+

# Find names with parentheses
Search:  \([^)]+\)

# Find corporate authors
Search:  (Collaborators|Group|Association|Institute|Center)$
```

---

## Suggested Preloaded Pattern Sets

1. **"Fix Zotero Import Errors"** - Commas, suffixes, parentheses
2. **"Normalize Dutch Names"** - van/de prefixes to lowercase
3. **"Normalize German Names"** - von prefixes to lowercase
4. **"Normalize Scottish Names"** - Mc/Mac prefixes
5. **"Fix Polish Diacritics"** - Ensure ł, ń, ś, etc. are preserved
6. **"Corporate to Group Authors"** - Identify and reclassify organizations
