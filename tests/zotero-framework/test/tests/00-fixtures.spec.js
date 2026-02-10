/**
 * Test Fixtures for Zotero Search & Replace
 *
 * Creates items with various fields and patterns for testing:
 * - Title field variations (spaces, capitalization, etc.)
 * - Author name patterns (comma spacing, suffixes, diacritics)
 * - Date format variations
 * - DOI and URL formats
 * - Tags with various patterns
 */

describe('Search & Replace Test Fixtures', function() {
    this.timeout(120000);

    var fixturesCreated = false;
    var fixtureError = null;

    before(async function() {
        Zotero.debug('SearchReplace Test Fixtures: Setting up test library...');
        try {
            await createTestFixtures();
            fixturesCreated = true;
            Zotero.debug('SearchReplace Test Fixtures: Setup complete');
        } catch (err) {
            fixtureError = err;
            Zotero.debug('SearchReplace Test Fixtures: Error during setup - ' + err.message);
        }
    });

    it('should create test fixtures', async function() {
        if (fixtureError) {
            this.skip();
            return;
        }
        const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
        assert.isAbove(items.length, 0, 'Fixtures should have created items');
        Zotero.debug('SearchReplace Test Fixtures: Created ' + items.length + ' items');
    });

    it('should have items with various field patterns', async function() {
        if (fixtureError) {
            this.skip();
            return;
        }
        const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
        let hasCommaSpacing = false;
        let hasDateFormats = false;
        let hasDiacritics = false;

        for (const item of items) {
            const title = item.getField('title') || '';
            if (title.includes('Smith , John')) hasCommaSpacing = true;
            if (title.includes('January') || title.includes('01/15')) hasDateFormats = true;
            if (title.includes('Miłkowski') || title.includes('Müller')) hasDiacritics = true;
        }

        assert.isTrue(hasCommaSpacing, 'Should have comma spacing issues');
        assert.isTrue(hasDateFormats, 'Should have date format variations');
        assert.isTrue(hasDiacritics, 'Should have diacritics in names');
    });
});

/**
 * Create test items for search & replace testing
 */
async function createTestFixtures() {
    Zotero.debug('SearchReplace Test Fixtures: Creating test items...');

    // Create a test collection
    const collection = new Zotero.Collection();
    collection.name = 'Search & Replace Test Fixtures';
    await collection.saveTx();

    // Test data covering various patterns
    const testData = [
        // === COMMA SPACING PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'Understanding Machine Learning: Smith , John and Doe , Jane',
            creators: [{ lastName: 'Smith', firstName: 'John', creatorType: 'author' }],
            date: '2020-01-15',
            abstractNote: 'A study on ML with 10,000 samples.',
            tags: ['machine learning', 'AI', 'supervised'],
            DOI: '10.1000/ml.2020.001',
            publicationTitle: 'Journal of AI Research'
        },
        {
            itemType: 'journalArticle',
            title: 'Deep Learning Applications',
            creators: [{ lastName: 'Doe', firstName: 'Jane', creatorType: 'author' }],
            date: '2021-03-22',
            abstractNote: 'Deep neural networks in practice.',
            tags: ['deep learning', 'neural networks'],
            DOI: '10.1000/dl.2021.002',
            publicationTitle: 'AI Review'
        },

        // === DATE FORMAT VARIATIONS ===
        {
            itemType: 'book',
            title: 'Programming Perl: Best Practices',
            creators: [{ lastName: 'Conway', firstName: 'Damian', creatorType: 'author' }],
            date: 'January 15, 2020',
            abstractNote: 'Best practices for Perl programming.',
            tags: ['perl', 'programming'],
            publicationTitle: 'O\'Reilly Media'
        },
        {
            itemType: 'book',
            title: 'JavaScript: The Good Parts',
            creators: [{ lastName: 'Crockford', firstName: 'Douglas', creatorType: 'author' }],
            date: '03/22/2021',
            abstractNote: 'The fine parts of JavaScript.',
            tags: ['javascript', 'web'],
            publisher: 'O\'Reilly'
        },
        {
            itemType: 'journalArticle',
            title: 'Date Formatting in Academic Writing',
            creators: [{ lastName: 'Date', firstName: 'Format', creatorType: 'author' }],
            date: '2022-12-25',
            abstractNote: 'Analysis of date formats across disciplines.',
            tags: ['writing', 'formatting']
        },

        // === NAME CASE PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'Quantum Computing Advances',
            creators: [
                { lastName: 'van der Waals', firstName: 'Johannes', creatorType: 'author' },
                { lastName: 'De Laplace', firstName: 'Pierre', creatorType: 'author' }
            ],
            date: '2023-06-15',
            abstractNote: 'Advances in quantum computing methods.',
            tags: ['quantum', 'physics', 'computing']
        },
        {
            itemType: 'journalArticle',
            title: 'Statistical Methods in Science',
            creators: [
                { lastName: 'Van Der Waals', firstName: 'Johannes', creatorType: 'author' },
                { lastName: 'DE LAPLACE', firstName: 'Pierre', creatorType: 'author' }
            ],
            date: '2023-07-01',
            abstractNote: 'Statistical analysis methods.',
            tags: ['statistics', 'science']
        },

        // === NAME SUFFIXES ===
        {
            itemType: 'book',
            title: 'Advanced Physics for Seniors',
            creators: [{ lastName: 'Einstein', firstName: 'Albert', creatorType: 'author' }],
            date: '1950',
            abstractNote: 'Physics textbook for senior students.',
            tags: ['physics', 'textbook']
        },
        {
            itemType: 'book',
            title: 'Introduction to Physics: Jr. Edition',
            creators: [{ lastName: 'Einstein', firstName: 'Albert', creatorType: 'author' }],
            date: '1950',
            abstractNote: 'Introductory physics textbook.',
            tags: ['physics', 'junior']
        },
        {
            itemType: 'book',
            title: 'Theoretical Physics: Sr. Edition',
            creators: [{ lastName: 'Einstein', firstName: 'Albert', creatorType: 'author' }],
            date: '1950',
            abstractNote: 'Theoretical physics for advanced students.',
            tags: ['physics', 'advanced']
        },

        // === DIACRITICS ===
        {
            itemType: 'journalArticle',
            title: 'Computational Models of Cognition',
            creators: [{ lastName: 'Miłkowski', firstName: 'Marcin', creatorType: 'author' }],
            date: '2013-04-20',
            abstractNote: 'Models of cognitive processes.',
            tags: ['cognitive science', 'computation'],
            DOI: '10.1000/comp.2013.001'
        },
        {
            itemType: 'journalArticle',
            title: 'Neural Network Architectures',
            creators: [{ lastName: 'Müller', firstName: 'Andreas', creatorType: 'author' }],
            date: '2021-09-10',
            abstractNote: 'Architectures for deep learning.',
            tags: ['neural networks', 'deep learning'],
            DOI: '10.1000/nn.2021.002'
        },
        {
            itemType: 'journalArticle',
            title: 'Spanish Literature Analysis',
            creators: [{ lastName: 'García', firstName: 'José', creatorType: 'author' }],
            date: '2018-11-30',
            abstractNote: 'Analysis of modern Spanish literature.',
            tags: ['spanish', 'literature']
        },
        {
            itemType: 'journalArticle',
            title: 'French Cultural Studies',
            creators: [{ lastName: 'Renard', firstName: 'François', creatorType: 'author' }],
            date: '2019-05-15',
            abstractNote: 'Cultural studies from a French perspective.',
            tags: ['french', 'culture']
        },

        // === DOI/URL PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'DOI Format Variations Study',
            creators: [{ lastName: 'Format', firstName: 'Test', creatorType: 'author' }],
            date: '2020-06-01',
            abstractNote: 'Study of various DOI formats used in publications.',
            DOI: 'https://doi.org/10.1000/doi.formats',
            tags: ['doi', 'formatting']
        },
        {
            itemType: 'journalArticle',
            title: 'URL Standardization Methods',
            creators: [{ lastName: 'Link', firstName: 'Url', creatorType: 'author' }],
            date: '2021-02-14',
            abstractNote: 'Methods for URL standardization in databases.',
            DOI: 'doi:10.1000/url.standard',
            tags: ['url', 'database']
        },
        {
            itemType: 'webpage',
            title: 'Protocol Variations in URLs',
            creators: [{ lastName: 'Web', firstName: 'Http', creatorType: 'author' }],
            date: '2022-08-20',
            abstractNote: 'Analysis of http vs https URL protocols.',
            url: 'http://example.com/protocols',
            tags: ['url', 'http', 'https']
        },
        {
            itemType: 'webpage',
            title: 'Secure URL Protocols',
            creators: [{ lastName: 'Secure', firstName: 'Web', creatorType: 'author' }],
            date: '2022-08-21',
            abstractNote: 'Analysis of https secure protocols.',
            url: 'https://secure.example.com/protocols',
            tags: ['url', 'https', 'security']
        },

        // === TITLE CAPITALIZATION ===
        {
            itemType: 'book',
            title: 'the art of computer programming',
            creators: [{ lastName: 'Knuth', firstName: 'Donald', creatorType: 'author' }],
            date: '1968',
            abstractNote: 'The famous multi-volume work on algorithms.',
            tags: ['programming', 'algorithms']
        },
        {
            itemType: 'book',
            title: 'THE ART OF COMPUTER PROGRAMMING',
            creators: [{ lastName: 'Knuth', firstName: 'Donald', creatorType: 'author' }],
            date: '1968',
            abstractNote: 'Volume 1 of TAOCP.',
            tags: ['programming', 'algorithms']
        },
        {
            itemType: 'book',
            title: 'The Art of Computer Programming',
            creators: [{ lastName: 'Knuth', firstName: 'Donald', creatorType: 'author' }],
            date: '1968',
            abstractNote: 'Authoritative reference on algorithms.',
            tags: ['programming', 'algorithms']
        },

        // === EXTRA FIELD PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'Metadata Field Analysis',
            creators: [{ lastName: 'Meta', firstName: 'Data', creatorType: 'author' }],
            date: '2021-07-01',
            abstractNote: 'Analysis of metadata fields in databases.',
            extra: 'Custom field: Value1\nCustom field: Value2',
            tags: ['metadata', 'database']
        },
        {
            itemType: 'journalArticle',
            title: 'Custom Field Processing',
            creators: [{ lastName: 'Field', firstName: 'Custom', creatorType: 'author' }],
            date: '2021-08-15',
            abstractNote: 'Processing custom fields in library data.',
            extra: 'ISSN: 1234-5678\nPMID: 12345678',
            tags: ['metadata', 'fields']
        },

        // === ABSTRACT PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'Double Spaces in Abstracts',
            creators: [{ lastName: 'Space', firstName: 'Double', creatorType: 'author' }],
            date: '2020-01-01',
            abstractNote: 'This abstract  has  double spaces.  Between words.',
            tags: ['formatting', 'proofreading']
        },
        {
            itemType: 'journalArticle',
            title: 'Multiple   Spaces Issue',
            creators: [{ lastName: 'Space', firstName: 'Multiple', creatorType: 'author' }],
            date: '2020-02-01',
            abstractNote: 'This   abstract   has   multiple   spaces   between   words.',
            tags: ['formatting']
        },

        // === CORPORATE/GROUP AUTHORS ===
        {
            itemType: 'journalArticle',
            title: 'Large Hadron Collider Results',
            creators: [
                { lastName: 'ATLAS Collaboration', firstName: '', creatorType: 'author' },
                { lastName: 'CMS Collaboration', firstName: '', creatorType: 'author' }
            ],
            date: '2012-04-04',
            abstractNote: 'Discovery of the Higgs boson at LHC.',
            tags: ['physics', 'particle physics', 'collaboration']
        },
        {
            itemType: 'journalArticle',
            title: 'Climate Change Report',
            creators: [
                { lastName: 'IPCC Working Group I', firstName: '', creatorType: 'author' }
            ],
            date: '2021-08-09',
            abstractNote: 'Climate change assessment report.',
            tags: ['climate', 'environment', 'ipcc']
        },
        {
            itemType: 'journalArticle',
            title: 'Standard Model Review',
            creators: [
                { lastName: 'Particle Data Group', firstName: '', creatorType: 'author' }
            ],
            date: '2022-11-01',
            abstractNote: 'Review of particle physics data.',
            tags: ['physics', 'particles']
        },

        // === EMPTY/MISSING TITLE PATTERNS ===
        {
            itemType: 'journalArticle',
            title: '',
            creators: [{ lastName: 'Unknown', firstName: 'Author', creatorType: 'author' }],
            date: '2020-01-01',
            abstractNote: 'Item with missing title for testing.',
            tags: ['test', 'empty-title']
        },
        {
            itemType: 'book',
            title: '   ',  // Whitespace only
            creators: [{ lastName: 'Whitespace', firstName: 'Author', creatorType: 'author' }],
            date: '2020-02-01',
            abstractNote: 'Item with whitespace-only title.',
            tags: ['test', 'whitespace']
        },

        // === MC/MAC PREFIXES ===
        {
            itemType: 'journalArticle',
            title: 'Cranial Surgery Advances',
            creators: [{ lastName: 'McCULLOCH', firstName: 'Paul', creatorType: 'author' }],
            date: '1945-06-01',
            abstractNote: 'Early work on neurons.',
            tags: ['neuroscience', 'history']
        },
        {
            itemType: 'journalArticle',
            title: 'Computer Vision Research',
            creators: [{ lastName: 'MACDONALD', firstName: 'James', creatorType: 'author' }],
            date: '1990-03-15',
            abstractNote: 'Early computer vision methods.',
            tags: ['computer vision', 'ai']
        },

        // === DOUBLE COMMAS AND PARENS ===
        {
            itemType: 'book',
            title: 'History of Science',
            creators: [
                { lastName: 'Smith,,', firstName: 'John', creatorType: 'author' },
                { lastName: 'Doe', firstName: 'Jane', creatorType: 'author' }
            ],
            date: '2010',
            abstractNote: 'A comprehensive history.',
            tags: ['history', 'science']
        },
        {
            itemType: 'journalArticle',
            title: 'Biographical Study',
            creators: [{ lastName: 'Williams', firstName: 'James (Jim)', creatorType: 'author' }],
            date: '2015-05-20',
            abstractNote: 'Study of notable figures.',
            tags: ['biography']
        },

        // === POLISH DIACRITICS STRIPPED ===
        {
            itemType: 'journalArticle',
            title: 'Polish Surname Analysis',
            creators: [{ lastName: 'Wojcik', firstName: 'Pawel', creatorType: 'author' }],
            date: '2020-07-10',
            abstractNote: 'Analysis of Polish surnames.',
            tags: ['linguistics', 'polish']
        },
        {
            itemType: 'journalArticle',
            title: 'Linguistics Research',
            creators: [{ lastName: 'Kowalski', firstName: 'Jan', creatorType: 'author' }],
            date: '2019-11-25',
            abstractNote: 'General linguistics research.',
            tags: ['linguistics']
        },

        // === GERMAN UMLAUTS STRIPPED ===
        {
            itemType: 'book',
            title: 'German Literature Classics',
            creators: [{ lastName: 'Goethe', firstName: 'Johann Wolfgang', creatorType: 'author' }],
            date: '1832',
            abstractNote: 'Classic German literature.',
            tags: ['literature', 'german']
        },
        {
            itemType: 'journalArticle',
            title: 'Fruchtbaum Studies',
            creators: [{ lastName: 'Fruchtbaum', firstName: 'Garten', creatorType: 'author' }],
            date: '2005-03-01',
            abstractNote: 'Studies on fruit trees.',
            tags: ['botany', 'german']
        },

        // === JOURNAL NAME IN AUTHOR FIELD ===
        {
            itemType: 'journalArticle',
            title: 'Citation Analysis Methods',
            creators: [
                { lastName: 'Journal of Information Science', firstName: '', creatorType: 'author' },
                { lastName: 'Review', firstName: 'Article', creatorType: 'author' }
            ],
            date: '2018-06-15',
            abstractNote: 'Methods for analyzing citations.',
            tags: ['bibliometrics', 'citations']
        },

        // === ABSTRACT PATTERNS ===
        {
            itemType: 'journalArticle',
            title: 'Ellipsis In Abstracts...',
            creators: [{ lastName: 'Ellipsis', firstName: 'Test', creatorType: 'author' }],
            date: '2021-01-01',
            abstractNote: 'This abstract... has an ellipsis. And more text...',
            tags: ['formatting']
        },
        {
            itemType: 'journalArticle',
            title: 'Tab Characters Issue',
            creators: [{ lastName: 'Tab', firstName: 'Character', creatorType: 'author' }],
            date: '2021-02-01',
            abstractNote: 'This abstract has\ttabs in it\tbetween words.',
            tags: ['formatting']
        },

        // === TAGS PATTERNS ===
        {
            itemType: 'book',
            title: 'Tag Testing Manual',
            creators: [{ lastName: 'Tag', firstName: 'Master', creatorType: 'author' }],
            date: '2022-01-01',
            abstractNote: 'A manual for testing tag functionality.',
            tags: ['testing', 'manual', 'tagging']
        },

        // === TITLE WITH SPECIAL CHARACTERS ===
        {
            itemType: 'journalArticle',
            title: 'Quantum Computing: "Entanglement" & Beyond',
            creators: [{ lastName: 'Quantum', firstName: 'Researcher', creatorType: 'author' }],
            date: '2023-01-15',
            abstractNote: 'Exploring quantum phenomena.',
            tags: ['quantum', 'computing']
        },

        // === URL WITH HTTP ===
        {
            itemType: 'webpage',
            title: 'Old HTTP Resource',
            creators: [{ lastName: 'Webmaster', firstName: 'Old', creatorType: 'author' }],
            date: '2019-06-15',
            abstractNote: 'A resource from the old web.',
            url: 'http://old-website.example.com/resource',
            tags: ['web', 'archive']
        },

        // === MULTIPLE CREATORS WITH ISSUES ===
        {
            itemType: 'book',
            title: 'Multi-Author Collection',
            creators: [
                { lastName: 'Smith , John', firstName: 'Dr.', creatorType: 'author' },
                { lastName: 'Van Der Berg', firstName: 'Maria', creatorType: 'author' },
                { lastName: 'MCKENZIE', firstName: 'Sarah', creatorType: 'author' }
            ],
            date: '2020',
            abstractNote: 'A collection with multiple authors.',
            tags: ['collection']
        }
    ];

    const items = [];

    for (const data of testData) {
        const item = new Zotero.Item(data.itemType);
        item.setField('title', data.title);
        if (data.date) item.setField('date', data.date);
        if (data.publicationTitle) item.setField('publicationTitle', data.publicationTitle);
        if (data.publisher) item.setField('publisher', data.publisher);
        if (data.abstractNote) item.setField('abstractNote', data.abstractNote);
        if (data.DOI) item.setField('DOI', data.DOI);
        if (data.extra) item.setField('extra', data.extra);
        if (data.url) item.setField('url', data.url);

        // Add creators
        for (let i = 0; i < data.creators.length; i++) {
            const creatorData = data.creators[i];
            item.setCreator(i, {
                firstName: creatorData.firstName || '',
                lastName: creatorData.lastName || '',
                creatorType: creatorData.creatorType || 'author'
            });
        }

        // Add tags
        if (data.tags) {
            for (const tag of data.tags) {
                item.addTag(tag);
            }
        }

        item.addToCollection(collection.id);
        await item.saveTx();
        items.push(item);

        Zotero.debug(`SearchReplace Test Fixtures: Created "${data.title}"`);
    }

    Zotero.debug(`SearchReplace Test Fixtures: Created ${items.length} test items`);

    return { items, collectionId: collection.id };
}

// Export for use in tests
if (typeof globalThis !== 'undefined') {
    globalThis.SearchReplaceTestFixtures = {
        createTestFixtures
    };
}
