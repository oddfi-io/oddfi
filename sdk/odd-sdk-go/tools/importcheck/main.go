// Package main implements the repository import-direction gate.
package main

import (
	"errors"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type violation struct {
	file       string
	importPath string
	rule       string
}

type rule struct {
	name      string
	dirPrefix string
	imports   []string
}

func main() {
	root := flag.String("root", ".", "repository root")
	flag.Parse()

	violations, err := Check(*root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "importcheck: %v\n", err)
		os.Exit(2)
	}
	if len(violations) == 0 {
		fmt.Println("importcheck: ok")
		return
	}

	for _, v := range violations {
		fmt.Fprintf(os.Stderr, "%s imports %q: %s\n", v.file, v.importPath, v.rule)
	}
	os.Exit(1)
}

// Check validates documented import-direction constraints under root.
func Check(root string) (violations []violation, err error) {
	root, err = filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve root: %w", err)
	}
	rootDir, err := os.OpenRoot(root)
	if err != nil {
		return nil, fmt.Errorf("open root: %w", err)
	}
	defer func() {
		if closeErr := rootDir.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("close root: %w", closeErr))
		}
	}()

	modulePath, err := readModulePath(rootDir)
	if err != nil {
		return nil, err
	}

	rules := []rule{
		{
			name:      "internal/domain must not import application, infrastructure, net/http, generated bindings, or concrete RPC clients",
			dirPrefix: filepath.Join("internal", "domain"),
			imports: []string{
				modulePath + "/internal/application",
				modulePath + "/internal/infrastructure",
				modulePath + "/internal/infrastructure/bindings",
				"github.com/ethereum/go-ethereum/ethclient",
				"net/http",
			},
		},
		{
			name:      "internal/application must not import infrastructure, generated bindings, or concrete RPC clients",
			dirPrefix: filepath.Join("internal", "application"),
			imports: []string{
				modulePath + "/internal/infrastructure",
				modulePath + "/internal/infrastructure/bindings",
				"github.com/ethereum/go-ethereum/ethclient",
			},
		},
		{
			name:      "pkg must not import generated bindings directly",
			dirPrefix: "pkg",
			imports: []string{
				modulePath + "/internal/infrastructure/bindings",
			},
		},
		{
			name:      "examples must not import generated bindings directly",
			dirPrefix: "examples",
			imports: []string{
				modulePath + "/internal/infrastructure/bindings",
			},
		},
	}

	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if shouldSkipDir(root, path, entry.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(entry.Name(), ".go") {
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("rel path for %s: %w", path, err)
		}
		imports, err := parseImports(path)
		if err != nil {
			return err
		}
		for _, r := range rules {
			if !inDir(rel, r.dirPrefix) {
				continue
			}
			for _, importPath := range imports {
				if blockedImport(importPath, r.imports) {
					violations = append(violations, violation{
						file:       filepath.ToSlash(rel),
						importPath: importPath,
						rule:       r.name,
					})
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("scan imports: %w", err)
	}

	slices.SortFunc(violations, func(a, b violation) int {
		if a.file != b.file {
			return strings.Compare(a.file, b.file)
		}
		if a.importPath != b.importPath {
			return strings.Compare(a.importPath, b.importPath)
		}
		return strings.Compare(a.rule, b.rule)
	})
	return violations, nil
}

func readModulePath(rootDir *os.Root) (string, error) {
	data, err := rootDir.ReadFile("go.mod")
	if err != nil {
		return "", fmt.Errorf("read go.mod: %w", err)
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "module" {
			return fields[1], nil
		}
	}
	return "", errors.New("read go.mod: module directive not found")
}

func shouldSkipDir(root, path, name string) bool {
	if path == root {
		return false
	}
	switch name {
	case ".git", "vendor", "node_modules":
		return true
	default:
		return false
	}
}

func parseImports(path string) ([]string, error) {
	fileSet := token.NewFileSet()
	file, err := parser.ParseFile(fileSet, path, nil, parser.ImportsOnly)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	imports := make([]string, 0, len(file.Imports))
	for _, spec := range file.Imports {
		importPath, err := importLiteral(spec)
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", path, err)
		}
		imports = append(imports, importPath)
	}
	return imports, nil
}

func importLiteral(spec *ast.ImportSpec) (string, error) {
	if spec.Path == nil {
		return "", errors.New("nil import path")
	}
	value := spec.Path.Value
	if len(value) < 2 || value[0] != '"' || value[len(value)-1] != '"' {
		return "", fmt.Errorf("unsupported import literal %q", value)
	}
	return value[1 : len(value)-1], nil
}

func inDir(relPath, dirPrefix string) bool {
	relPath = filepath.ToSlash(relPath)
	dirPrefix = filepath.ToSlash(dirPrefix)
	return strings.HasPrefix(relPath, dirPrefix+"/")
}

func blockedImport(importPath string, blockedPrefixes []string) bool {
	for _, prefix := range blockedPrefixes {
		if importPath == prefix || strings.HasPrefix(importPath, prefix+"/") {
			return true
		}
	}
	return false
}
