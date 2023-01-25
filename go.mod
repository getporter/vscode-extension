module get.porter.sh/vscode-extension

go 1.19

// See https://github.com/getporter/magefiles/pull/21
// setupdco
replace get.porter.sh/magefiles => github.com/carolynvs/magefiles v0.1.3-0.20230125172107-729bea4d75e2

require (
	get.porter.sh/magefiles v0.3.4
	github.com/carolynvs/magex v0.9.0
	github.com/magefile/mage v1.14.0
)

require github.com/Masterminds/semver/v3 v3.1.1 // indirect
