import { XMLParser } from 'fast-xml-parser';

const parserCurrent = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    new Set([
      'title',
      'abstract',
      'keywords',
      'keyword',
      'author',
      'citation',
      'id',
      'givenname',
      'familyname',
      'affiliation',
    ]).has(name),
});

const xmlTest = `<publication>
  <title locale="es_ES">Hayek&#x2019;s Bastards</title>
  <keywords locale="es_ES">
    <keyword>Un &#xE9;xito</keyword>
    <keyword>Bogot&#xE1;</keyword>
  </keywords>
</publication>`;

const result = parserCurrent.parse(xmlTest);
console.log('CURRENT CONFIG (NO htmlEntities):');
console.log(JSON.stringify(result, null, 2));

const parserFixed = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    new Set([
      'title',
      'abstract',
      'keywords',
      'keyword',
      'author',
      'citation',
      'id',
      'givenname',
      'familyname',
      'affiliation',
    ]).has(name),
  htmlEntities: true,
});

const resultFixed = parserFixed.parse(xmlTest);
console.log('\nWITH htmlEntities: true:');
console.log(JSON.stringify(resultFixed, null, 2));
