import { describe, it, expect } from 'vitest'
import { validateQuery, SafetyError } from '../validator'

describe('validateQuery', () => {
  describe('rejects write/DDL/DCL statements', () => {
    const dangerousCases: Array<[string, string]> = [
      ['INSERT INTO door VALUES (?)', 'INSERT'],
      ['UPDATE door SET col = ?', 'UPDATE'],
      ['DELETE FROM door WHERE id = ?', 'DELETE'],
      ['DROP TABLE door', 'DROP'],
      ['ALTER TABLE door ADD col INT', 'ALTER'],
      ['CREATE TABLE test (id INT)', 'CREATE'],
      ['TRUNCATE TABLE door', 'TRUNCATE'],
      ['RENAME TABLE door TO door2', 'RENAME'],
      ['GRANT SELECT ON door TO user', 'GRANT'],
      ['REVOKE SELECT ON door FROM user', 'REVOKE'],
      ['MERGE INTO door USING src ON (...)', 'MERGE'],
      ['REPLACE INTO door VALUES (?)', 'REPLACE'],
      ['LOAD DATA INFILE "/tmp/data" INTO TABLE door', 'LOAD'],
      ['SET @x = 1', 'SET'],
      ['LOCK TABLES door READ', 'LOCK'],
      ['UNLOCK TABLES', 'UNLOCK'],
      ['USE other_db', 'USE'],
    ]

    for (const [sql, label] of dangerousCases) {
      it(`rejects ${label}: ${sql.slice(0, 50)}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects case variations', () => {
    const cases: string[] = [
      'DrOp TaBlE door',
      'INSERT into door values (?)',
      'dElEtE FROM door',
      '  UPDATE door SET x = 1',
      '\n\tDROP TABLE door',
    ]
    for (const sql of cases) {
      it(`rejects: ${sql.trim().slice(0, 40)}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects body-level dangerous keywords', () => {
    const cases: Array<[string, string]> = [
      ['SELECT 1; DELETE FROM door', 'multi-statement with DELETE'],
      ['SELECT * FROM door INTO OUTFILE "/tmp/x"', 'OUTFILE in body'],
      ['SELECT * FROM door INTO DUMPFILE "/tmp/x"', 'DUMPFILE in body'],
    ]
    for (const [sql, label] of cases) {
      it(`rejects ${label}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects comment smuggling', () => {
    it('strips block comments and still allows safe query', () => {
      expect(() => validateQuery('SELECT 1 /* DROP TABLE door */')).not.toThrow()
    })

    it('rejects if dangerous keyword is outside comment', () => {
      expect(() => validateQuery('/* safe */ DROP TABLE door')).toThrow(SafetyError)
    })
  })

  describe('rejects multi-statement queries', () => {
    it('rejects semicolon before end', () => {
      expect(() => validateQuery('SELECT 1; SELECT 2')).toThrow(SafetyError)
    })

    it('allows trailing semicolon', () => {
      expect(() => validateQuery('SELECT 1;')).not.toThrow()
    })
  })

  describe('rejects invalid CALL names', () => {
    const invalidNames: Array<[string, string]> = [
      ["CALL '; DROP TABLE door; --()", 'injection attempt'],
      ['CALL 123.bad()', 'dotted name'],
      ['CALL sp name()', 'space in name'],
      ['CALL ()', 'missing name'],
    ]
    for (const [sql, label] of invalidNames) {
      it(`rejects CALL with ${label}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects empty/whitespace input', () => {
    it('rejects empty string', () => {
      expect(() => validateQuery('')).toThrow(SafetyError)
    })
    it('rejects whitespace only', () => {
      expect(() => validateQuery('   \n\t  ')).toThrow(SafetyError)
    })
  })

  describe('allows safe SELECT queries', () => {
    const safeCases: string[] = [
      'SELECT * FROM `door`',
      'SELECT `col1`, `col2` FROM `door` WHERE `id` = ?',
      'SELECT COUNT(*) AS count FROM `product`',
      'SELECT DISTINCT `Vnpp` FROM `dpur` WHERE `Vnpp` IS NOT NULL ORDER BY `Vnpp`',
      'SELECT `site_code`, `site_name` FROM `dpur` ORDER BY `site_name` LIMIT 1000',
      'SELECT `saleperson_key`,`off_date` FROM `door` WHERE `off_date` >= ? AND `off_date` <= ? AND `ship_from_code` = ? LIMIT 50000',
    ]
    for (const sql of safeCases) {
      it(`allows: ${sql.slice(0, 60)}...`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })

  describe('allows SHOW/DESCRIBE/EXPLAIN', () => {
    const cases: string[] = [
      'SHOW TABLES',
      'SHOW DATABASES',
      'SHOW GRANTS FOR CURRENT_USER()',
      'DESCRIBE door',
      'DESC dpur',
      'EXPLAIN SELECT * FROM door WHERE id = ?',
    ]
    for (const sql of cases) {
      it(`allows: ${sql}`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })

  describe('allows CTE queries', () => {
    it('allows WITH ... SELECT', () => {
      expect(() =>
        validateQuery('WITH cte AS (SELECT 1 AS n) SELECT * FROM cte')
      ).not.toThrow()
    })
  })

  describe('allows valid CALL statements', () => {
    const cases: string[] = [
      'CALL dashboard_npp_list()',
      'CALL get_ton_kho_data(?,?,?,?)',
      'CALL get_check_customers_list(?,?,?,?,?,?,?,?,?,?)',
    ]
    for (const sql of cases) {
      it(`allows: ${sql}`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })
})
