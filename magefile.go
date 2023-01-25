//go:build mage

// This is a magefile, and is a "makefile for go".
// See https://magefile.org/
package main

import (
	"github.com/carolynvs/magex/mgx"
	"github.com/carolynvs/magex/pkg"
	"github.com/carolynvs/magex/shx"
	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/target"
)

var must = shx.CommandBuilder{StopOnError: true}

func ensureVSCE() {
	ok, err := pkg.IsCommandAvailable("vsce", "--version", "")
	mgx.Must(err)
	if !ok {
		must.RunV("npm", "install", "-g", "vsce")
	}
}

func npmInstall() {
	needsNpmInstall, err := target.Dir("node_modules", "package.json")
	mgx.Must(err)
	if needsNpmInstall {
		must.RunV("npm", "install")
	}
}

func Compile() error {
	mg.Deps(npmInstall)
	return must.RunV("npm", "run", "compile")
}

func Test() error {
	mg.Deps(npmInstall)
	return must.RunV("npm", "run", "test")
}

func Package() error {
	mg.Deps(ensureVSCE)
	return must.RunV("vsce", "package")
}

func SetupDCO() {

}