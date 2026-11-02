# Лицензия на содержимое каталога content/

Содержимое (тексты, вопросы, списки слов) распространяется на условиях
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**:
https://creativecommons.org/licenses/by-sa/4.0/

Эта лицензия выбрана потому, что часть данных наследует условия BY-SA (Octanove Vocabulary Profile C1/C2).
Владелец репозитория должен подтвердить выбор лицензии и права на собственные тексты.

## Происхождение

- `reading/*.json`: оригинальные тексты и вопросы, написаны для этого проекта с помощью Claude
  (модель Anthropic) по заданию владельца репозитория и проверены автоматическими инструментами
  (`engine/qa_reading.py`, `engine/textprofile.py`). Проверка носителем английского языка и
  статистический анализ на пилоте ещё не выполнены. Правовой статус текстов, созданных ИИ,
  зависит от юрисдикции: уточнить до коммерческого использования.
- `vocab/pool.json`: выборка слов из CEFR-J Vocabulary Profile 1.5 и Octanove Vocabulary Profile C1/C2
  плюс сгенерированные и просмотренные псевдослова.

## Обязательные указания источников

- «The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.»
  (по README https://github.com/openlanguageprofiles/olp-en-cefrj: бесплатное исследовательское и
  коммерческое использование при цитировании).
- Octanove Vocabulary Profile C1/C2, лицензия CC BY-SA 4.0.
- Для отсева псевдослов использовался публичный список dwyl/english-words (Unlicense); в репозиторий он не входит.
